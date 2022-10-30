import * as Minecraft from "@minecraft/server";
import { getItemCountReturn } from "../../@types/build/classes/PlayerBuilder.js";
import { Server } from "./serverBuilder.js";

type Player = Minecraft.Player;

export class PlayerBuilder {
  /**
   * Tests if the player has the permission for certain actions
   * @param {Player} player Player to test for permissions
   * @param {string} perm The permission string being tested
   * @returns {boolean}
   */
  hasPermission(player: Player, perm: string) {
    if (!perm) return true;

    let included = false;
    const permLevels = perm.split(".");
    for (const tag of player.getTags()) {
      const levels = tag.split(".");
      let negate = false;
      if (levels[0].startsWith("+")) {
        negate = false;
        levels[0] = levels[0].substring(1);
      } else if (levels[0].startsWith("-")) {
        negate = true;
        levels[0] = levels[0].substring(1);
      }

      if (levels.every((level, i) => level == permLevels[i])) {
        if (negate) {
          return false;
        } else {
          included = true;
        }
      }
    }

    return included;
  }
  /**
   * Look if player is in the game
   * @param {string} player Player you are looking for
   * @returns {boolean}
   * @example PlayerBuilder.find('notbeer');
   */
  find(player: string): boolean {
    const players = this.list();
    return !!players.find(p => {
      return p.name == player;
    });
  }
  /**
   * Get list of players in game
   * @returns {Array<string>}
   * @example PlayerBuilder.list();
   */
  list(): Array<Player> {
    return Array.from(Minecraft.world.getPlayers()) as Array<Player>;
  }
  /**
   * Get the player's inventory container
   * @param {Player} [player] Player of interest
   * @returns {InventoryComponentContainer}
   */
  getInventory(player: Player) {
    return (player.getComponent("minecraft:inventory") as Minecraft.EntityInventoryComponent).container;
  }
  /**
   * Get the amount on a specific items player(s) has
   * @param {Player} [player] Player you are searching
   * @param {string} itemIdentifier Item you are looking for
   * @param {number} [itemData] Item data you are looking for
   * @returns {Array<getItemCountReturn>}
   */
  getItemCount(player: Player, itemIdentifier: string, itemData?: number): Array<getItemCountReturn> {
    const itemCount: Array<getItemCountReturn> = [];
    const inventory = this.getInventory(player);
    for (let slot = 0; slot < inventory.size; slot++) {
      const item = inventory.getItem(slot);
      if (item?.typeId == itemIdentifier && (itemData == undefined || item?.data == itemData)) {
        itemCount.push({ count: item.amount, slot });
      }
    }
    return itemCount;
  }
  /**
    * Get the current item in the player's main hand
    * @param {Player} [player] Player you are searching
    * @returns {?ItemStack}
    */
  getHeldItem(player: Player) {
    return this.getInventory(player).getItem(player.selectedSlot);
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

    const stasher = player.dimension.spawnEntity("wedit:inventory_stasher", new Minecraft.BlockLocation(player.location.x, 512, player.location.z));
    stasher.nameTag = "wedit:stasher_for_" + player.name;

    const inv = (<Minecraft.EntityInventoryComponent> player.getComponent("inventory")).container;
    const inv_stash = (<Minecraft.EntityInventoryComponent> stasher.getComponent("inventory")).container;
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
    let stasher: Minecraft.Entity;
    const stasherName = "wedit:stasher_for_" + player.name;
    Server.runCommand(`tp @e[name="${stasherName}"] ~ 512 ~`, player);
    Server.runCommand(`tp @e[name="${stasherName}"] ~ 512 ~`, player);

    for (const entity of player.dimension.getEntities({ name: stasherName })) {
      stasher = entity;
    }

    if (stasher) {
      const inv = (<Minecraft.EntityInventoryComponent> player.getComponent("inventory")).container;
      const inv_stash = (<Minecraft.EntityInventoryComponent> stasher.getComponent("inventory")).container;
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
export const Player = new PlayerBuilder();