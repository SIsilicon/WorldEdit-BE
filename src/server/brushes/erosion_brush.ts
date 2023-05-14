import { Server, Vector, regionIterateBlocks } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Selection } from "@modules/selection.js";
import { BlockPermutation, Dimension, Vector3 } from "@minecraft/server";
import { directionVectors } from "@modules/directions.js";
import { getWorldHeightLimits } from "server/util.js";

class ErosionPreset {
  readonly erodeThreshold: number;
  readonly erodeIterations: number;
  readonly fillThreshold: number;
  readonly fillIterations: number;

  constructor(erodeThres: number, erodeIter: number, fillThres: number, fillIter: number) {
    this.erodeThreshold = erodeThres;
    this.erodeIterations = erodeIter;
    this.fillThreshold = fillThres;
    this.fillIterations = fillIter;
  }
}

export enum ErosionType {
  DEFAULT, LIFT, FILL, MELT, SMOOTH
}

const air = BlockPermutation.resolve("minecraft:air");

class BlockChange {
  readonly dimension: Dimension;
  private iteration = new Map<string, BlockPermutation>();
  private changes = new Map<string, BlockPermutation>();

  constructor(dim: Dimension) {
    this.dimension = dim;
  }

  getBlock(loc: Vector3) {
    const change = this.changes.get(this.vec2string(loc));
    try {
      return change ?? this.dimension.getBlock(loc).permutation ?? air;
    } catch {
      return air;
    }
  }

  setBlock(loc: Vector3, block: BlockPermutation) {
    this.iteration.set(this.vec2string(loc), block);
  }

  applyIteration() {
    this.changes = new Map([...this.changes, ...this.iteration]);
    this.iteration.clear();
  }

  *flush() {
    let i = 0;
    for (const [loc, block] of this.changes.entries()) {
      const vec = loc.split("_").map(v => Number.parseFloat(v));
      try {
        this.dimension.getBlock({x: vec[0], y: vec[1], z: vec[2]}).setPermutation(block);
      } catch { /* pass */ }
      yield ++i;
    }
  }

  private vec2string(vec: Vector3) {
    return "" + vec.x + "_" + vec.y + "_" + vec.z;
  }
}

/**
 * Shapes terrain in various ways
 */
export class ErosionBrush extends Brush {
  public readonly id = "erosion_brush";

  private radius: number;
  private preset: ErosionPreset;

  /**
    * @param radius The radius of the spheres
    * @param type The type of erosion brush
    */
  constructor(radius: number, type: ErosionType) {
    super();
    this.assertSizeInRange(radius);
    this.radius = radius;
    this.preset = erosionTypes.get(type);
  }

  public resize(value: number) {
    this.assertSizeInRange(value);
    this.radius = value;
  }

  public getSize(): number {
    return this.radius;
  }

  public paintWith() {
    throw "commands.generic.wedit:noMaterial";
  }

  public *apply(loc: Vector, session: PlayerSession, mask?: Mask) {
    const range: [Vector, Vector] = [loc.sub(this.radius), loc.add(this.radius)];
    const [minY, maxY] = getWorldHeightLimits(session.getPlayer().dimension);
    const activeMask = !mask ? session.globalMask : session.globalMask ? mask.intersect(session.globalMask) : mask;
    range[0].y = Math.max(minY, range[0].y);
    range[1].y = Math.min(maxY, range[1].y);

    const history = session.getHistory();
    const record = history.record();

    try {
      history.addUndoStructure(record, ...range);

      const blockChange = new BlockChange(session.getPlayer().dimension);
      for (let i = 0; i < this.preset.erodeIterations; i++) {
        yield* this.processErosion(range, this.preset.erodeThreshold, blockChange, activeMask);
      }
      for (let i = 0; i < this.preset.fillIterations; i++) {
        yield* this.processFill(range, this.preset.fillThreshold, blockChange, activeMask);
      }

      yield* blockChange.flush();
      history.addRedoStructure(record, ...range);
      history.commit(record);
    } catch (e) {
      history.cancel(record);
      throw e;
    }
  }

  public updateOutline(selection: Selection, loc: Vector): void {
    selection.mode = "sphere";
    selection.set(0, loc);
    selection.set(1, loc.offset(0, 0, this.radius));
  }

  private *processErosion(range: [Vector, Vector], threshold: number, blockChange: BlockChange, mask?: Mask) {
    const centre = Vector.add(...range).mul(0.5);
    const r2 = (this.radius + 0.5) * (this.radius + 0.5);
    const isAirOrFluid = Server.block.isAirOrFluid;

    for (const loc of regionIterateBlocks(...range)) {
      if (centre.sub(loc).lengthSqr > r2 || isAirOrFluid(blockChange.getBlock(loc)) || (mask && !mask.matchesBlock(blockChange.dimension.getBlock(loc)))) {
        continue;
      }

      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [_, dir] of directionVectors) {
        if (isAirOrFluid(blockChange.getBlock(Vector.add(loc, dir)))) {
          count++;
        }
      }

      if (count >= threshold) {
        blockChange.setBlock(loc, air);
      }
      yield 0;
    }
    blockChange.applyIteration();
  }

  private *processFill(range: [Vector, Vector], threshold: number, blockChange: BlockChange, mask?: Mask) {
    const centre = Vector.add(...range).mul(0.5);
    const r2 = (this.radius + 0.5) * (this.radius + 0.5);
    const isAirOrFluid = Server.block.isAirOrFluid;

    for (const loc of regionIterateBlocks(...range)) {
      if (centre.sub(loc).lengthSqr > r2 || !isAirOrFluid(blockChange.getBlock(loc))) {
        continue;
      }

      let count = 0;
      const blockTypes: [BlockPermutation, number][] = [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [_, dir] of directionVectors) {
        const block = blockChange.getBlock(Vector.add(loc, dir));
        if (!isAirOrFluid(block) && (!mask || mask.matchesBlock(blockChange.dimension.getBlock(Vector.add(loc, dir))))) {
          count++;
          let foundType = false;
          for (let i = 0; i < blockTypes.length; i++) {
            if (blockTypes[i][0].matches(block.type.id, block.getAllStates())) {
              blockTypes[i][1]++;
              foundType = true;
              break;
            }
          }
          if (!foundType) {
            blockTypes.push([block, 1]);
          }
        }
      }

      if (count >= threshold) {
        let maxCount = 0;
        let maxBlock: BlockPermutation;
        for (const [block, times] of blockTypes) {
          if (times > maxCount) {
            maxCount = times;
            maxBlock = block;
          }
        }
        blockChange.setBlock(loc, maxBlock);
      }
      yield 0;
    }
    blockChange.applyIteration();
  }
}

const erosionTypes = new Map<ErosionType, ErosionPreset>([
  [ErosionType.DEFAULT, new ErosionPreset(1, 1, 6, 0)],
  [ErosionType.LIFT, new ErosionPreset(6, 0, 1, 1)],
  [ErosionType.FILL, new ErosionPreset(5, 1, 2, 1)],
  [ErosionType.MELT, new ErosionPreset(2, 1, 5, 1)],
  [ErosionType.SMOOTH, new ErosionPreset(3, 1, 3, 1)]
]);
