import * as Minecraft from "@minecraft/server";
import { getItemCountReturn } from "../@types/classes/PlayerBuilder.js";

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
        return !!players.find((p) => {
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
     * Get the player's equipment component
     * @param {Player} [player] Player of interest
     * @returns {Minecraft.EntityEquippableComponent}
     */
    getEquipment(player: Player) {
        return player.getComponent("minecraft:equippable") as Minecraft.EntityEquippableComponent;
    }
    /**
     * Get the amount on a specific items player(s) has
     * @param {Player} [player] Player you are searching
     * @param {string} itemIdentifier Item you are looking for
     * @param {number} [itemData] Item data you are looking for
     * @returns {Array<getItemCountReturn>}
     */
    getItemCount(player: Player, itemIdentifier: string): Array<getItemCountReturn> {
        const itemCount: Array<getItemCountReturn> = [];
        const inventory = this.getInventory(player);
        for (let slot = 0; slot < inventory.size; slot++) {
            const item = inventory.getItem(slot);
            if (item?.typeId == itemIdentifier) {
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
}
export const Player = new PlayerBuilder();
