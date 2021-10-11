import * as Minecraft from 'mojang-minecraft';
import { Server } from './serverBuilder.js';
export class EntityBuilder {
    /**
     * Look for a tag on entitie(s)
     * @param {string} tag Tag you are seraching for (WARNING: Color Coding with § is ignored)
     * @param {string} [target] Requirements for the entity
     * @return {boolean}
     * @example EntityBuilder.hasTag("villager", '[type=villager]');
     */
    hasTag(tag, target) {
        const allTags = this.getTags(target);
        if (!allTags)
            return false;
        for (const Tag of allTags)
            if (Tag.replace(/§./g, '').match(new RegExp(`^${tag.replace(/§./g, '')}$`)))
                return true;
        return false;
    }
    ;
    /**
     * Get entitie(s) at a position
     * @param {number} x X position of the entity
     * @param {number} y Y position of the entity
     * @param {number} z Z position of the entity
     * @param {dimension} [dimension] Dimesion of the entity
     * @param {Array<string>} [ignoreType] Entity type to not look for
     * @returns {Array<getEntityAtPosReturn>}
     * @example EntityBuilder.getEntityAtPos([0, 5, 0], { dimension: 'nether', ignoreType: ['minecraft:player']});
     */
    getAtPos([x, y, z], { dimension, ignoreType } = {}) {
        try {
            const entity = Minecraft.World.getDimension(dimension ? dimension : 'overworld').getEntitiesAtBlockLocation(new Minecraft.BlockLocation(x, y, z));
            for (let i = 0; i < entity.length; i++)
                if (ignoreType.includes(entity[i].id))
                    entity.splice(i, 1);
            return { list: entity, error: false };
        }
        catch (err) {
            return { list: null, error: true };
        }
        ;
    }
    ;
    /**
     * Get all the tag on entitie(s)
     * @param {string} [target] Requirements for the entity
     * @returns {Array<string> | null}
     * @example EntityBuilder.getTags('[type=villager,name="Bob"]');
     */
    getTags(target) {
        const data = Server.runCommand(`tag @e${target ? `[${target.replace(/\]|\[/g, '')}]` : ''} list`);
        if (data.error)
            return;
        let tags = data.statusMessage.match(/(?<=: ).*$/);
        if (tags)
            return tags[0].split('§r, §a');
    }
    ;
    /**
     * Get score of an entity
     * @param {string} objective Objective name you want to search
     * @param {string} [target] Requirements for the entity
     * @param {number} [minimum] Minumum score you are looking for
     * @param {number} [maximum] Maximum score you are looking for
     * @returns {number | null}
     * @example EntityBuilder.getScore('Money', '[type=villager,name="Bob"]', { minimum: 0 });
     */
    getScore(objective, target, { minimum, maximum } = {}) {
        const data = Server.runCommand(`scoreboard players test @e${target ? `[${target.replace(/\]|\[/g, '')}]` : ''} ${objective} ${minimum ? minimum : '*'} ${maximum ? maximum : '*'}`);
        if (data.error)
            return;
        return parseInt(data.statusMessage.match(/-?\d+/)[0]);
    }
    ;
}
;
export const Entity = new EntityBuilder();
