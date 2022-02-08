import * as Minecraft from 'mojang-minecraft';
import { Server } from './serverBuilder.js';
import { getPlayerAtPosReturn, getItemCountReturn } from '../../@types/build/classes/PlayerBuilder.js';

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
        const permLevels = perm.split('.');
        for (const tag of player.getTags()) {
            const levels = tag.split('.');
            let negate = false;
            if (levels[0].startsWith('+')) {
                negate = false;
                levels[0] = levels[0].substring(1);
            } else if (levels[0].startsWith('-')) {
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
    };
    /**
    * Get list of players in game
    * @returns {Array<string>}
    * @example PlayerBuilder.list();
    */
    list(): Array<Player> {
        return Array.from(Minecraft.world.getPlayers()) as Array<Player>;
    };
    /**
    * Get the amount on a specific items player(s) has
    * @param {Player} [player] Player you are searching
    * @param {string} itemIdentifier Item you are looking for
    * @param {number} [itemData] Item data you are looking for
    * @returns {Array<getItemCountReturn>}
    */
    getItemCount(player: Player, itemIdentifier: string, itemData?: number): Array<getItemCountReturn> {
        let itemCount: Array<getItemCountReturn> = [];
        const data = Server.runCommand(`clear @s ${itemIdentifier} ${itemData ? itemData : '0'} 0`, player);
        if(data.error) return itemCount;
        data.playerTest.forEach(element => {
            const count = parseInt(element.match(/(?<=.*?\().+?(?=\))/)[0]);
            const player = element.match(/^.*(?= \(\d+\))/)[0];
            itemCount.push({ player, count });
        });
        return itemCount ? itemCount : [];
    };
    /**
    * Get players score on a specific objective
    * @param {Player} player Requirements for the entity
    * @param {string} objective Objective name you want to search
    * @param {number} [minimum] Minumum score you are looking for
    * @param {number} [maximum] Maximum score you are looking for
    * @returns {number}
    * @example PlayerBuilder.getScore('Money', 'notbeer', { minimum: 0 });
    */
    getScore(player: Player, objective: string, { minimum, maximum }: { minimum?: number, maximum?: number } = {}): number {
        const data = Server.runCommand(`scoreboard players test @s ${objective} ${minimum ? minimum : '*'} ${maximum ? maximum : '*'}`, player);
        if(data.error) return;
        return parseInt(data.statusMessage.match(/-?\d+/)[0]);
    };
};
export const Player = new PlayerBuilder();