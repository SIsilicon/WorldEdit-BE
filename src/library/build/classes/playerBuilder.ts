import * as Minecraft from 'mojang-minecraft';
import { Server } from './serverBuilder.js';
import { dimension } from '../../@types/index';
import { getPlayerAtPosReturn, getItemCountReturn } from '../../@types/build/classes/PlayerBuilder.js';

export class PlayerBuilder {
    /**
    * Look if player is in the game
    * @param {string} player Player you are looking for
    * @returns {boolean}
    * @example PlayerBuilder.findPlayer('notbeer');
    */
    find(player: string): boolean {
        const players = this.list();
        return players.includes(player);
    };
    /**
    * Look for a tag on player(s)
    * @param {string} tag Tag you are seraching for (WARNING: Color Coding with § is ignored)
    * @param {string} [player] Requirements for the entity
    * @returns {boolean}
    * @example PlayerBuilder.hasTag("Owner", 'notbeer');
    */
    hasTag(tag: string, player: string): boolean {
        if (Server.runCommand(`tag "${player}" remove ${tag}`).error) {
                return false;
        } else {
                Server.runCommand(`tag "${player}" add ${tag}`);
                return true;
        }
        /*const allTags = this.getTags(player);
        if(!allTags) return false;
        for(const Tag of allTags) if(Tag.replace(/§./g, '').match(new RegExp(`^${tag.replace(/§./g, '')}$`))) return true;*/
    };
    /**
    * Get players(s) at a position
    * @param {number} x X position of the entity 
    * @param {number} y Y position of the entity
    * @param {number} z Z position of the entity 
    * @param {dimension} [dimension] Dimesion of the entity
    * @returns {getPlayerAtPosReturn}
    * @example PlayerBuilder.getEntityAtPos([0, 5, 0], { dimension: 'nether' ]});
    */
    getAtPos([x, y, z]: [number, number, number], { dimension }: { dimension?: dimension } = {}): getPlayerAtPosReturn {
        try {
                const entity = Minecraft.World.getDimension(dimension ? dimension : 'overworld').getEntitiesAtBlockLocation(new Minecraft.BlockLocation(x, y, z));
                for(let i = 0; i < entity.length; i++)
                    if(entity[i].id !== 'minecraft:player') entity.splice(i, 1);
                return { list: entity, error: false };
        } catch (err) {
                return { list: null, error: true };
        };
    };
    /**
    * Get tags player(s) has
    * @param {string} [player] Requirements for the entity
    * @returns {Array<string>}
    * @example PlayerBuilder.getTags('notbeer');
    */
    getTags(player?: string): Array<string> {
        const data = Server.runCommand(`tag "${player}" list`);
        if(data.error) return;
        let tags = data.statusMessage.match(/(?<=: ).*$/);
        if(tags) return tags[0].split('§r, §a');
    };
    /**
    * Get list of players in game
    * @returns {Array<string>}
    * @example PlayerBuilder.list();
    */
    list(): Array<string> {
        // CHANGED
        const data = Minecraft.World.getPlayers();
        return data.map(x => x.nameTag);
    };
    /**
    * Get the amount on a specific items player(s) has
    * @param {string} itemIdentifier Item you are looking for
    * @param {number} [itemData] Item data you are looking for
    * @param {string} [player] Player you are searching
    * @returns {Array<getItemCountReturn>}
    * @example PlayerBuilder.getItemCount('minecraft:diamond', '0', 'notbeer');
    */
    getItemCount(itemIdentifier: string, itemData?: number, player?: string): Array<getItemCountReturn> {
        let itemCount: Array<getItemCountReturn> = [];
        const data = Server.runCommand(`clear "${player}" ${itemIdentifier} ${itemData ? itemData : '0'} 0`);
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
    * @param {string} objective Objective name you want to search
    * @param {string} player Requirements for the entity
    * @param {number} [minimum] Minumum score you are looking for
    * @param {number} [maximum] Maximum score you are looking for
    * @returns {number}
    * @example PlayerBuilder.getScore('Money', 'notbeer', { minimum: 0 });
    */
    getScore(objective: string, player: string, { minimum, maximum }: { minimum?: number, maximum?: number } = {}): number {
        const data = Server.runCommand(`scoreboard players test "${player}" ${objective} ${minimum ? minimum : '*'} ${maximum ? maximum : '*'}`);
        if(data.error) return;
        return parseInt(data.statusMessage.match(/-?\d+/)[0]);
    };
};
export const Player = new PlayerBuilder();