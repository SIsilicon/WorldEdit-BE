import * as Minecraft from "@minecraft/server";
import { getEntityAtPosReturn } from "../../@types/build/classes/EntityBuilder";

export class EntityBuilder {
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
  getAtPos([x, y, z]: [number, number, number], { dimension, ignoreType }: { dimension?: Minecraft.Dimension, ignoreType?: Array<string> } = {}): getEntityAtPosReturn {
    try {
      const entity = (dimension ?? Minecraft.world.getDimension("overworld")).getEntitiesAtBlockLocation(new Minecraft.BlockLocation(x, y, z));
      for(let i = 0; i < entity.length; i++)
        if(ignoreType.includes(entity[i].typeId)) entity.splice(i, 1);
      return { list: entity, error: false };
    } catch (err) {
      return { list: null, error: true };
    }
  }
}
export const Entity = new EntityBuilder();