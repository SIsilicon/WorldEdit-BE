import { Player, Entity, BlockLocation, EntityInventoryComponent } from "@minecraft/server";
import { Server, contentLog } from "@notbeer-api";
import { Mask } from "./mask.js";
import config from "config.js";

/**
 * This singleton holds utility and miscellaneous functions for players.
 */
class PlayerHandler {

  constructor() {
    Server.on("playerChangeDimension", ev => {
      // Teleport the inventory stasher with the player
      contentLog.debug(`"${ev.player.name}" has travelled to "${ev.dimension.id}"`);
      const stasherName = "wedit:stasher_for_" + ev.player.name;
      Server.runCommand(`tp @e[name="${stasherName}"] ~ 512 ~`, ev.player);
    });
  }

  /**
   * Tells you whether the player has an item.
   * @param player The player being tested
   * @param item The item being tested for
   * @return True if the player has the item; false otherwise
   */
  hasItem(player: Player, item: string, data?: number) {
    let hasItem = Server.player.getItemCount(player, item, data).length != 0;
    if (this.isHotbarStashed(player) && !hasItem) {
      let stasher: Entity;
      for (const entity of player.dimension.getEntities({ name: "wedit:stasher_for_" + player.name })) {
        stasher = entity;
      }

      if (stasher) {
        const inv_stash = (<EntityInventoryComponent> stasher.getComponent("inventory")).container;
        for (let i = 0; i < 9; i++) {
          const stashed = inv_stash.getItem(i);
          if (stashed && stashed.typeId == item && (stashed.data == data || data < 0)) {
            hasItem = true;
            break;
          }
        }
      }
    }
    return hasItem;
  }

  /**
   * Replaces an item stack in the player's inventory with another item.
   * @remark This does not check the player's armor slots nor offhand.
   * @param player The player being affected
   * @param item The item being replaced
   * @param sub The new item being replaced with
   */
  replaceItem(player: Player, item: string, sub: string, locked = false) {
    const inv = (<EntityInventoryComponent> player.getComponent("inventory")).container;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId === item) {
        const slotType = i > 8 ? "slot.inventory" : "slot.hotbar";
        const slotId = i > 8 ? i - 9 : i;
        let command = `replaceitem entity @s ${slotType} ${slotId} ${sub}`;
        if (locked) {
          command += ` ${inv.getItem(i).amount} ${inv.getItem(i).data} {"minecraft:item_lock":{"mode":"lock_in_slot"}}`;
        }
        Server.runCommand(command, player);
        break;
      }
    }
  }

  /**
   * Gives the player's location in the form of {@minecraft/server.BlockLocation}.
   * @param player The player being queried
   * @return The block location of the player
   */
  getBlockLocation(player: Player) {
    return new BlockLocation(
      Math.floor(player.location.x),
      Math.floor(player.location.y),
      Math.floor(player.location.z)
    );
  }

  /**
   * Traces a block from the player's head in the direction they're looking,
   * @param player The player to trace for blocks from
   * @param range How far to trace for blocks
   * @param mask What kind of blocks the ray can hit
   * @return The location of the block the ray hits or reached its range at; null otherwise
   */
  traceForBlock(player: Player, range?: number, mask?: Mask) {
    const start = player.headLocation;
    const dir = player.viewVector;
    const dim = player.dimension;

    let prevPoint = new BlockLocation(Infinity, Infinity, Infinity);
    for (let i = 0; i < config.navWandDistance; i += 0.2) {
      const point = new BlockLocation(
        Math.floor(start.x + dir.x * i),
        Math.floor(start.y + dir.y * i),
        Math.floor(start.z + dir.z * i)
      );
      if (prevPoint.equals(point)) continue;
      prevPoint = point;

      if (mask && mask.matchesBlock(point, dim)) {
        return point;
      } else if (!mask && dim.getBlock(point).typeId != "minecraft:air") {
        return point;
      } else if (range && range > 0 && i >= range) {
        return point;
      }
    }
  }

  /**
   * Tells you whether the player's hotbar has been stashed in a temporary place.
   * @param player The player being queried
   * @return Whether the player's hotbar has been stashed
   */
  isHotbarStashed(player: Player) {
    return Array.from(player.dimension.getEntities({
      name: `wedit:stasher_for_${player.name}`
    })).length != 0;
  }

  /**
   * Stashes the player's hotbar in a temporary entity.
   * @param player The player being affected
   * @return True if the player's hotbar has already been stashed; false otherwise
   */
  stashHotbar(player: Player) {
    if (this.isHotbarStashed(player)) {
      return true;
    }

    const stasher = player.dimension.spawnEntity("wedit:inventory_stasher", new BlockLocation(player.location.x, 512, player.location.z));
    stasher.nameTag = "wedit:stasher_for_" + player.name;

    const inv = (<EntityInventoryComponent> player.getComponent("inventory")).container;
    const inv_stash = (<EntityInventoryComponent> stasher.getComponent("inventory")).container;
    for (let i = 0; i < 9; i++) {
      inv.transferItem(i, i, inv_stash);
    }
    return false;
  }

  /**
   * Restores the player's hotbar from a temporary entity.
   * @param player The player being affected
   * @return True if the player's hotbar hasn't been stashed yet; false otherwise
   */
  restoreHotbar(player: Player) {
    let stasher: Entity;
    const stasherName = "wedit:stasher_for_" + player.name;
    Server.runCommand(`tp @e[name="${stasherName}"] ~ 512 ~`, player);
    Server.runCommand(`tp @e[name="${stasherName}"] ~ 512 ~`, player);

    for (const entity of player.dimension.getEntities({ name: stasherName })) {
      stasher = entity;
    }

    if (stasher) {
      const inv = (<EntityInventoryComponent> player.getComponent("inventory")).container;
      const inv_stash = (<EntityInventoryComponent> stasher.getComponent("inventory")).container;
      for (let i = 0; i < 9; i++) {
        if (inv.getItem(i) && inv_stash.getItem(i)) {
          inv.swapItems(i, i, inv_stash);
        } else if (inv.getItem(i)) {
          inv.transferItem(i, i, inv_stash);
        } else {
          inv_stash.transferItem(i, i, inv);
        }
      }
      Server.runCommand(`tp @e[name="${stasherName}"] ~ ~ ~`, player);
      stasher.triggerEvent("wedit:despawn");
      stasher.nameTag = "despawned";
      return false;
    } else {
      return true;
    }
  }
}

export const PlayerUtil = new PlayerHandler();