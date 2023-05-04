import { contentLog, generateId, iterateChunk, regionIterateBlocks, regionSize, regionTransformedBounds, regionVolume, Server, StructureLoadOptions, StructureSaveOptions, Thread, Vector } from "@notbeer-api";
import { Block, BlockPermutation, Dimension, Vector3 } from "@minecraft/server";
import { blockHasNBTData, getViewVector, locToString, stringToLoc } from "../util.js";
import { EntityCreateEvent } from "library/@types/Events.js";
import { Mask } from "./mask.js";

export interface RegionLoadOptions {
    rotation?: Vector
    flip?: Vector
    mask?: Mask
}

type blockData = BlockPermutation|[string, BlockPermutation]
type blockList = Vector3[] | ((loc: Vector3) => boolean | BlockPermutation) | "all"

interface transformContext {
  blockData: blockData
  sampleBlock: (loc: Vector) => blockData
}

export class RegionBuffer {

  readonly isAccurate: boolean;
  readonly id: string;

  private size = Vector.ZERO;
  private blocks = new Map<string, blockData>();
  private blockCount = 0;
  private subId = 0;
  private savedEntities = false;
  private imported = "";

  constructor(isAccurate = false) {
    this.isAccurate = isAccurate;
    this.id = "wedit:buffer_" + generateId();
    contentLog.debug("creating structure", this.id);
  }

  public save(start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}, blocks: blockList = "all") {
    const save = this.saveProgressive(start, end, dim, options, blocks);
    let val: IteratorResult<number, boolean>;
    let lastPromise: unknown;
    while (!val?.done) {
      val = save.next(lastPromise);
      lastPromise = undefined;
    }
    return val.value;
  }

  public* saveProgressive(start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}, blocks: blockList = "all"): Generator<number, boolean> {
    if (this.isAccurate) {
      const min = Vector.min(start, end);
      const iterate = (blockLoc: Vector3) => {
        const relLoc = Vector.sub(blockLoc, min).floor();
        const block = dim.getBlock(blockLoc);
        if (blockHasNBTData(block)) {
          const id = this.id + "_" + this.subId++;
          this.saveBlockAsStruct(id, blockLoc, dim);
          this.blocks.set(locToString(relLoc), [id, block.permutation.clone()]);
        } else {
          this.blocks.set(locToString(relLoc), block.permutation.clone());
        }
      };

      let count = 0;
      const isFilter = typeof blocks == "function";
      if (blocks == "all" || isFilter) {
        const volume = regionVolume(start, end);
        let i = 0;
        for (const block of regionIterateBlocks(start, end)) {
          if (!isFilter) {
            iterate(block);
            count++;
          } else {
            const filtered = blocks(block);
            if (typeof filtered != "boolean") {
              const relLoc = Vector.sub(block, min).floor();
              this.blocks.set(locToString(relLoc), filtered);
              count++;
            } else if (filtered) {
              iterate(block);
              count++;
            }
          }
          if (iterateChunk()) yield i / volume;
          i++;
        }
      } else if (Array.isArray(blocks)) {
        for (let i = 0; i < blocks.length; i++) {
          iterate(blocks[i]);
          if (iterateChunk()) yield i / blocks.length;
        }
        count = blocks.length;
      }
      this.blockCount = count;
      if (options.includeEntities) {
        Server.structure.save(this.id, start, end, dim, {
          includeBlocks: false,
          includeEntities: true
        });
      }
    } else {
      if (Server.structure.save(this.id, start, end, dim, options)) {
        return true;
      }
      this.blockCount = regionVolume(start, end);
    }
    this.imported = "";
    this.savedEntities = options.includeEntities;
    this.size = regionSize(start, end);
    return false;
  }

  public load(loc: Vector3, dim: Dimension, options?: RegionLoadOptions) {
    const load = this.loadProgressive(loc, dim, options);
    let val: IteratorResult<number, void>;
    let lastPromise: unknown;
    while (!val?.done) {
      val = load.next(lastPromise);
      lastPromise = undefined;
    }
    return val.value;
  }

  public* loadProgressive(loc: Vector3, dim: Dimension, options: RegionLoadOptions = {}): Generator<number, void> {
    const rotFlip: [Vector, Vector] = [options.rotation ?? Vector.ZERO, options.flip ?? Vector.ONE];
    if (this.isAccurate) {
      const bounds = regionTransformedBounds(
        Vector.ZERO,
        Vector.sub(this.size, [1,1,1]).floor(),
        Vector.ZERO, ...rotFlip
      );
      const shouldTransform = options.rotation || options.flip;

      let transform: (block: BlockPermutation) => BlockPermutation;
      if (shouldTransform) {
        transform = block => {
          const blockName = block.type.id;
          const attachement = block.getState("attachement") as string;
          const direction = block.getState("direction") as number;
          const doorHingeBit = block.getState("door_hinge_bit") as boolean;
          const facingDir = block.getState("facing_direction") as number;
          const groundSignDir = block.getState("ground_sign_direction") as number;
          const openBit = block.getState("open_bit") as boolean;
          const pillarAxis = block.getState("pillar_axis") as string;
          const topSlotBit = block.getState("top_slot_bit") as boolean;
          const upsideDownBit = block.getState("upside_down_bit") as boolean;
          const weirdoDir = block.getState("weirdo_direction") as number;
          const torchFacingDir = block.getState("torch_facing_direction") as string;
          const leverDir = block.getState("lever_direction") as string;
          const cardinalDir = block.getState("minecraft:cardinal_direction") as string;

          const withProperties = (properties: Record<string, string | number | boolean>) => {
            for (const prop in properties) {
              block = block.withState(prop, properties[prop]);
            }
            return block;
          };

          if (upsideDownBit != null && openBit != null && direction != null) {
            const states = (this.transformMapping(mappings.trapdoorMap, `${upsideDownBit}_${openBit}_${direction}`, ...rotFlip) as string).split("_");
            block = withProperties({ "upside_down_bit": states[0] == "true", "open_bit": states[1] == "true", "direction": parseInt(states[2]) });
          } else if (weirdoDir != null && upsideDownBit != null) {
            const states = (this.transformMapping(mappings.stairsMap, `${upsideDownBit}_${weirdoDir}`, ...rotFlip) as string).split("_");
            block = withProperties({ "upside_down_bit": states[0] == "true", "weirdo_direction": parseInt(states[1]) });
          } else if (doorHingeBit != null && direction != null) {
            const states = (this.transformMapping(mappings.doorMap, `${doorHingeBit}_${direction}`, ...rotFlip) as string).split("_");
            block = withProperties({ "door_hinge_bit": states[0] == "true", "direction": parseInt(states[1]) });
          } else if (attachement != null && direction != null) {
            const states = (this.transformMapping(mappings.bellMap, `${attachement}_${direction}`, ...rotFlip) as string).split("_");
            block = withProperties({ "attachement": states[0], "direction": parseInt(states[1]) });
          } else if (facingDir != null) {
            const state = this.transformMapping(mappings.facingDirectionMap, facingDir, ...rotFlip);
            block = block.withState("facing_direction", parseInt(state));
          } else if (direction != null) {
            const mapping = blockName.includes("powered_repeater") || blockName.includes("powered_comparator") ? mappings.redstoneMap : mappings.directionMap;
            const state = this.transformMapping(mapping, direction, ...rotFlip);
            block = block.withState("direction", parseInt(state));
          } else if (cardinalDir != null) {
            const state = this.transformMapping(mappings.cardinalDirectionMap, cardinalDir, ...rotFlip);
            block = block.withState("minecraft:cardinal_direction", state);
          } else if (groundSignDir != null) {
            const state = this.transformMapping(mappings.groundSignDirectionMap, groundSignDir, ...rotFlip);
            block = block.withState("ground_sign_direction", parseInt(state));
          } else if (torchFacingDir != null) {
            const state = this.transformMapping(mappings.torchMap, torchFacingDir, ...rotFlip);
            block = block.withState("torch_facing_direction", state);
          } else if (leverDir != null) {
            const state = this.transformMapping(mappings.leverMap, leverDir, ...rotFlip);
            block = block.withState("lever_direction", state.replace("0", ""));
          } else if (pillarAxis != null) {
            const state = this.transformMapping(mappings.pillarAxisMap, pillarAxis + "_0", ...rotFlip);
            block = block.withState("pillar_axis", state[0]);
          } else if (topSlotBit != null) {
            const state = this.transformMapping(mappings.topSlotMap, String(topSlotBit), ...rotFlip);
            block = block.withState("top_slot_bit", state == "true");
          }
          return block;
        };
      } else {
        transform = block => block;
      }

      let i = 0;
      for (const [key, block] of this.blocks.entries()) {
        let blockLoc = stringToLoc(key);
        if (shouldTransform) {
          blockLoc = Vector.from(blockLoc)
            .rotateY(rotFlip[0].y).rotateX(rotFlip[0].x).rotateZ(rotFlip[0].z)
            .mul(rotFlip[1]).sub(bounds[0]).floor();
        }

        blockLoc = blockLoc.offset(loc.x, loc.y, loc.z);
        const oldBlock = dim.getBlock(blockLoc);
        if (options.mask && !options.mask.matchesBlock(oldBlock)) continue;

        if (block instanceof BlockPermutation) {
          oldBlock.setPermutation(transform(block));
        } else {
          this.loadBlockFromStruct(block[0], blockLoc, dim);
          oldBlock.setPermutation(transform(block[1]));
        }
        if (iterateChunk()) yield i / this.blocks.size;
        i++;
      }

      if (this.savedEntities) {
        const onEntityload = (ev: EntityCreateEvent) => {
          if (shouldTransform) {
            // FIXME: Not properly aligned
            let entityLoc = ev.entity.location;
            let entityFacing = Vector.from(getViewVector(ev.entity)).add(entityLoc);

            entityLoc = Vector.from(entityLoc).sub(loc)
              .rotateY(rotFlip[0].y).rotateX(rotFlip[0].x).rotateZ(rotFlip[0].z)
              .mul(rotFlip[1]).sub(bounds[0]).add(loc);
            entityFacing = Vector.from(entityFacing).sub(loc)
              .rotateY(rotFlip[0].y).rotateX(rotFlip[0].x).rotateZ(rotFlip[0].z)
              .mul(rotFlip[1]).sub(bounds[0]).add(loc);

            ev.entity.teleport(entityLoc, {
              dimension: dim,
              facingLocation: entityFacing
            });
          }
        };

        Server.on("entityCreate", onEntityload);
        Server.structure.load(this.id, loc, dim);
        Server.off("entityCreate", onEntityload);
      }
    } else {
      const loadOptions: StructureLoadOptions = {
        rotation: rotFlip[0].y,
        flip: "none"
      };
      if (options.flip?.z == -1) loadOptions.flip = "x";
      if (options.flip?.x == -1) loadOptions.flip += "z";
      if (loadOptions.flip as string == "nonez") loadOptions.flip = "z";
      if (this.imported) loadOptions.importedSize = Vector.from(this.size);
      Server.structure.load(this.imported || this.id, loc, dim, loadOptions);
    }
  }

  /**
   * @param func
   * @returns
   */
  public* warp(func: (loc: Vector3, ctx: transformContext) => blockData): Generator<number, null> {
    if (!this.isAccurate) {
      return;
    }

    const region: [Vector, Vector] = [Vector.ZERO.floor(), this.size.sub(-1)];
    const output = new Map();
    const volume = regionVolume(...region);
    const sampleBlock = (loc: Vector) => this.blocks.get(locToString(loc));

    let i = 0;
    for (const coord of regionIterateBlocks(...region)) {
      const block = func(coord, {
        blockData: this.blocks.get(locToString(coord)),
        sampleBlock
      });
      if (block) {
        output.set(locToString(coord), block);
      }
      yield ++i / volume;
    }

    this.blocks = output;
    this.blockCount = this.blocks.size;
  }

  public* create(start: Vector3, end: Vector3, func: (loc: Vector3) => Block | BlockPermutation): Generator<number, null> {
    if (!this.isAccurate || !this.size.equals(Vector.ZERO)) {
      return;
    }

    this.size = regionSize(start, end);
    const region: [Vector, Vector] = [Vector.ZERO.floor(), this.size.offset(-1, -1, -1)];
    const volume = regionVolume(...region);

    let i = 0;
    for (const coord of regionIterateBlocks(...region)) {
      const block = func(coord);
      if (block) {
        if (block instanceof Block && blockHasNBTData(block)) {
          const id = this.id + "_" + this.subId++;
          this.saveBlockAsStruct(id, block.location, block.dimension);
          this.blocks.set(locToString(coord), [id, block.permutation.clone()]);
        } else {
          this.blocks.set(locToString(coord), block instanceof Block ? block.permutation.clone() : block);
        }
      }
      yield ++i / volume;
    }
    this.blockCount = this.blocks.size;
  }

  public getSize() {
    return this.size;
  }

  public getBlockCount() {
    return this.blockCount;
  }

  public getBlock(loc: Vector) {
    if (!this.isAccurate) {
      return null;
    }

    const block = this.blocks.get(locToString(loc));
    if (Array.isArray(block)) {
      return block[1];
    } else if (block) {
      return block;
    }
  }

  public getBlocks() {
    return Array.from(this.blocks.values());
  }

  public setBlock(loc: Vector3, block: Block | BlockPermutation, options?: StructureSaveOptions & {loc?: Vector, dim?: Dimension}) {
    let error: boolean;
    const key = locToString(loc);

    if (this.blocks.has(key) && Array.isArray(this.blocks.get(key))) {
      this.deleteBlockStruct((this.blocks.get(key) as [string, BlockPermutation])[0]);
    }

    if (block instanceof BlockPermutation) {
      if (options?.includeEntities) {
        const id = this.id + "_" + this.subId++;
        error = Server.structure.save(id, options.loc, options.loc, options.dim, options);
        this.blocks.set(key, [id, block]);
      } else {
        this.blocks.set(key, block);
      }
    } else {
      const id = this.id + "_" + this.subId++;
      error = Server.structure.save(id, block.location, block.location, block.dimension, options);
      this.blocks.set(key, [id, block.permutation.clone()]);
    }
    this.size = Vector.max(this.size, Vector.from(loc).add(1)).floor();
    this.blockCount = this.blocks.size;
    return error ?? false;
  }

  public import(structure: string, size: Vector3) {
    this.imported = structure;
    this.size = Vector.from(size);
    this.blockCount = size.x * size.y * size.z;
  }

  public delete() {
    const thread = new Thread();
    thread.start(function* (self: RegionBuffer) {
      if (self.isAccurate) {
        const promises = [];
        for (const block of self.blocks.values()) {
          if (!(block instanceof BlockPermutation)) {
            promises.push(self.deleteBlockStruct(block[0]));
            yield;
          }
        }
        if (promises.length) {
          yield Promise.all(promises);
        }
        self.blocks.clear();
      }
      self.size = Vector.ZERO;
      self.blockCount = 0;
      yield Server.structure.delete(self.id);
      contentLog.debug("deleted structure", self.id);
    }, this);
  }

  private transformMapping(mapping: {[key: string|number]: Vector | [number, number, number]}, state: string|number, rotate: Vector, flip: Vector): string {
    let vec = Vector.from(mapping[state]);
    if (!vec) {
      contentLog.debug(`Can't map state "${state}".`);
      return typeof(state) == "string" ? state : state.toString();
    }
    vec = vec.rotateY(rotate.y).rotateX(rotate.x).rotateZ(rotate.z);
    vec = vec.mul(flip);

    let closestState: string;
    let closestDot = -1000;
    for (const newState in mapping) {
      const dot = Vector.from(mapping[newState]).dot(vec);
      if (dot > closestDot) {
        closestState = newState;
        closestDot = dot;
      }
    }

    return closestState;
  }

  private saveBlockAsStruct(id: string, loc: Vector3, dim: Dimension) {
    const locStr = `${loc.x} ${loc.y} ${loc.z}`;
    return Server.runCommand(`structure save ${id} ${locStr} ${locStr} false memory`, dim);
  }

  private loadBlockFromStruct(id: string, loc: Vector3, dim: Dimension) {
    const locStr = `${loc.x} ${loc.y} ${loc.z}`;
    return Server.runCommand(`structure load ${id} ${locStr}`, dim);
  }

  private deleteBlockStruct(id: string) {
    Server.queueCommand(`structure delete ${id}`);
  }
}

const mappings = {
  topSlotMap: { // upside_down_bit
    false: new Vector(0, 1, 0),
    true : new Vector(0,-1, 0),
  },
  redstoneMap: {
    0: new Vector( 0, 0,-1),
    1: new Vector( 1, 0, 0),
    2: new Vector( 0, 0, 1),
    3: new Vector(-1, 0, 0)
  },
  directionMap: { // direction
    0: new Vector( 1, 0, 0),
    1: new Vector( 0, 0, 1),
    2: new Vector(-1, 0, 0),
    3: new Vector( 0, 0,-1)
  },
  facingDirectionMap: { // facing_direction
    0: new Vector( 0,-1, 0),
    1: new Vector( 0, 1, 0),
    2: new Vector( 0, 0,-1),
    3: new Vector( 0, 0, 1),
    4: new Vector(-1, 0, 0),
    5: new Vector( 1, 0, 0)
  },
  cardinalDirectionMap: { // minecraft:cardinal_direction
    north: new Vector( 0, 0,-1),
    south: new Vector( 0, 0, 1),
    west : new Vector(-1, 0, 0),
    east : new Vector( 1, 0, 0)
  },
  pillarAxisMap: { // pillar_axis
    x_0: new Vector( 1, 0, 0),
    y_0: new Vector( 0, 1, 0),
    z_0: new Vector( 0, 0, 1),
    x_1: new Vector(-1, 0, 0),
    y_1: new Vector( 0,-1, 0),
    z_1: new Vector( 0, 0,-1)
  },
  groundSignDirectionMap: { // ground_sign_direction
    0 : new Vector(0, 0, 1),
    1 : new Vector(0, 0, 1).rotateY( 1/16 * 360),
    2 : new Vector(0, 0, 1).rotateY( 2/16 * 360),
    3 : new Vector(0, 0, 1).rotateY( 3/16 * 360),
    4 : new Vector(0, 0, 1).rotateY( 4/16 * 360),
    5 : new Vector(0, 0, 1).rotateY( 5/16 * 360),
    6 : new Vector(0, 0, 1).rotateY( 6/16 * 360),
    7 : new Vector(0, 0, 1).rotateY( 7/16 * 360),
    8 : new Vector(0, 0, 1).rotateY( 8/16 * 360),
    9 : new Vector(0, 0, 1).rotateY( 9/16 * 360),
    10: new Vector(0, 0, 1).rotateY(10/16 * 360),
    11: new Vector(0, 0, 1).rotateY(11/16 * 360),
    12: new Vector(0, 0, 1).rotateY(12/16 * 360),
    13: new Vector(0, 0, 1).rotateY(13/16 * 360),
    14: new Vector(0, 0, 1).rotateY(14/16 * 360),
    15: new Vector(0, 0, 1).rotateY(15/16 * 360),
  },
  stairsMap: { // upside_down_bit - weirdo_direction
    false_0: new Vector(-1, 1, 0),
    false_1: new Vector( 1, 1, 0),
    false_2: new Vector( 0, 1,-1),
    false_3: new Vector( 0, 1, 1),
    true_0 : new Vector(-1,-1, 0),
    true_1 : new Vector( 1,-1, 0),
    true_2 : new Vector( 0,-1,-1),
    true_3 : new Vector( 0,-1, 1)
  },
  torchMap: { // torch_facing_direction
    north: new Vector( 0, 0, 1),
    east : new Vector(-1, 0, 0),
    south: new Vector( 0, 0,-1),
    west : new Vector( 1, 0, 0),
    top  : new Vector( 0, 1, 0)
  },
  leverMap: { // lever_direction
    north            : new Vector(  0,  0,  1),
    east             : new Vector( -1,  0,  0),
    south            : new Vector(  0,  0, -1),
    west             : new Vector(  1,  0,  0),
    up_north_south   : new Vector(  0,  1, .5),
    up_north_south0  : new Vector(  0,  1,-.5),
    up_east_west     : new Vector( .5,  1,  0),
    up_east_west0    : new Vector(-.5,  1,  0),
    down_north_south : new Vector(  0, -1, .5),
    down_north_south0: new Vector(  0, -1,-.5),
    down_east_west   : new Vector( .5, -1,  0),
    down_east_west0  : new Vector(-.5, -1,  0),
  },
  doorMap: { // door_hinge_bit - direction
    false_0: new Vector( 1, 0, 0.5),
    false_1: new Vector(-0.5, 0, 1),
    false_2: new Vector(-1, 0,-0.5),
    false_3: new Vector( 0.5, 0,-1),
    true_0: new Vector( 1, 0,-0.5),
    true_1: new Vector( 0.5, 0, 1),
    true_2: new Vector(-1, 0, 0.5),
    true_3: new Vector(-0.5, 0,-1)
  },
  bellMap: { // attachement - direction
    standing_0: new Vector( 1, 0.5, 0),
    standing_1: new Vector( 0, 0.5, 1),
    standing_2: new Vector(-1, 0.5, 0),
    standing_3: new Vector( 0, 0.5,-1),
    side_0: new Vector( 1, 0, 0),
    side_1: new Vector( 0, 0, 1),
    side_2: new Vector(-1, 0, 0),
    side_3: new Vector( 0, 0,-1),
    hanging_0: new Vector( 1,-0.5, 0),
    hanging_1: new Vector( 0,-0.5, 1),
    hanging_2: new Vector(-1,-0.5, 0),
    hanging_3: new Vector( 0,-0.5,-1)
  },
  trapdoorMap: { // upside_down_bit - open_bit - direction
    false_false_0: new Vector(-0.5, 1, 0),
    false_false_1: new Vector( 0.5, 1, 0),
    false_false_2: new Vector( 0, 1,-0.5),
    false_false_3: new Vector( 0, 1, 0.5),
    true_false_0: new Vector(-0.5, -1, 0),
    true_false_1: new Vector( 0.5, -1, 0),
    true_false_2: new Vector( 0, -1,-0.5),
    true_false_3: new Vector( 0, -1, 0.5),
    false_true_0: new Vector(-1, 0.5, 0),
    false_true_1: new Vector( 1, 0.5, 0),
    false_true_2: new Vector( 0, 0.5,-1),
    false_true_3: new Vector( 0, 0.5, 1),
    true_true_0: new Vector(-1, -0.5, 0),
    true_true_1: new Vector( 1, -0.5, 0),
    true_true_2: new Vector( 0, -0.5,-1),
    true_true_3: new Vector( 0, -0.5, 1)
  },
  // TODO: Support glow lychen
} as const;