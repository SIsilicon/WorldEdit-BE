import { contentLog, generateId, iterateChunk, regionIterateBlocks, regionSize, regionTransformedBounds, regionVolume, Server, StructureLoadOptions, StructureSaveOptions, Thread, Vector } from "@notbeer-api";
import { Block, BlockLocation, BlockPermutation, BoolBlockProperty, Dimension, EntityCreateEvent, IntBlockProperty, StringBlockProperty } from "@minecraft/server";
import { locToString, stringToLoc } from "../util.js";

export interface RegionLoadOptions {
    rotation?: Vector,
    flip?: Vector
}

type blockList = BlockLocation[] | ((loc: BlockLocation) => boolean | BlockPermutation) | "all"

export class RegionBuffer {

  readonly isAccurate: boolean;
  readonly id: string;

  private size = new BlockLocation(0, 0, 0);
  private blocks = new Map<string, BlockPermutation|[string, BlockPermutation]>();
  private blockCount = 0;
  private subId = 0;
  private savedEntities = false;

  constructor(isAccurate = false) {
    this.isAccurate = isAccurate;
    this.id = "wedit:buffer_" + generateId();
    contentLog.debug("creating structure", this.id);
  }

  public save(start: BlockLocation, end: BlockLocation, dim: Dimension, options: StructureSaveOptions = {}, blocks: blockList = "all") {
    const save = this.saveProgressive(start, end, dim, options, blocks);
    while (!save.next().done) continue;
    return save.next().value as boolean;
  }

  public* saveProgressive(start: BlockLocation, end: BlockLocation, dim: Dimension, options: StructureSaveOptions = {}, blocks: blockList = "all"): Generator<number, boolean> {
    if (this.isAccurate) {
      const min = Vector.min(start, end);
      const iterate = (blockLoc: BlockLocation) => {
        const relLoc = Vector.sub(blockLoc, min).toBlock();
        const id = this.id + "_" + this.subId++;
        this.saveBlockAsStruct(id, blockLoc, dim);
        this.blocks.set(locToString(relLoc), [id, dim.getBlock(blockLoc).permutation.clone()]);
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
              const relLoc = Vector.sub(block, min).toBlock();
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
    this.savedEntities = options.includeEntities;
    this.size = regionSize(start, end);
    return false;
  }

  public load(loc: BlockLocation, dim: Dimension, options?: RegionLoadOptions) {
    const load = this.loadProgressive(loc, dim, options);
    while (!load.next().done) continue;
    return load.next().value as boolean;
  }

  public* loadProgressive(loc: BlockLocation, dim: Dimension, options: RegionLoadOptions = {}): Generator<number, boolean> {
    const rotFlip: [Vector, Vector] = [options.rotation ?? Vector.ZERO, options.flip ?? Vector.ONE];
    if (this.isAccurate) {
      const bounds = regionTransformedBounds(
        new BlockLocation(0, 0, 0),
        Vector.sub(this.size, [1,1,1]).toBlock(),
        Vector.ZERO, ...rotFlip
      );
      const shouldTransform = options.rotation || options.flip;

      let transform: (block: BlockPermutation) => BlockPermutation;
      if (shouldTransform) {
        transform = block => {
          const newBlock = block.clone();
          const blockName = newBlock.type.id;
          const attachement = newBlock.getProperty("attachement") as StringBlockProperty;
          const direction = newBlock.getProperty("direction") as IntBlockProperty;
          const doorHingeBit = newBlock.getProperty("door_hinge_bit") as BoolBlockProperty;
          const facingDir = newBlock.getProperty("facing_direction") as StringBlockProperty;
          const groundSignDir = newBlock.getProperty("ground_sign_direction") as IntBlockProperty;
          const openBit = newBlock.getProperty("open_bit") as BoolBlockProperty;
          const pillarAxis = newBlock.getProperty("pillar_axis") as StringBlockProperty;
          const topSlotBit = newBlock.getProperty("top_slot_bit") as BoolBlockProperty;
          const upsideDownBit = newBlock.getProperty("upside_down_bit") as BoolBlockProperty;
          const weirdoDir = newBlock.getProperty("weirdo_direction") as IntBlockProperty;
          const torchFacingDir = newBlock.getProperty("torch_facing_direction") as StringBlockProperty;
          const leverDir = newBlock.getProperty("lever_direction") as StringBlockProperty;

          if (upsideDownBit && openBit && direction) {
            const states = (this.transformMapping(mappings.trapdoorMap, `${upsideDownBit.value}_${openBit.value}_${direction.value}`, ...rotFlip) as string).split("_");
            [upsideDownBit.value, openBit.value, direction.value] = [states[0] == "true", states[1] == "true", parseInt(states[2])];
          } else if (weirdoDir && upsideDownBit) {
            const states = (this.transformMapping(mappings.stairsMap, `${upsideDownBit.value}_${weirdoDir.value}`, ...rotFlip) as string).split("_");
            [upsideDownBit.value, weirdoDir.value] = [states[0] == "true", parseInt(states[1])];
          } else if (doorHingeBit && direction) {
            const states = (this.transformMapping(mappings.doorMap, `${doorHingeBit.value}_${direction.value}`, ...rotFlip) as string).split("_");
            [doorHingeBit.value, direction.value] = [states[0] == "true", parseInt(states[1])];
          } else if (attachement && direction) {
            const states = (this.transformMapping(mappings.bellMap, `${attachement.value}_${direction.value}`, ...rotFlip) as string).split("_");
            [attachement.value, direction.value] = [states[0], parseInt(states[1])];
          } else if (facingDir) {
            const state = this.transformMapping(mappings.facingDirectionMap, facingDir.value, ...rotFlip);
            facingDir.value = state;
          } else if (direction) {
            const mapping = blockName.includes("powered_repeater") || blockName.includes("powered_comparator") ? mappings.redstoneMap : mappings.directionMap;
            const state = this.transformMapping(mapping, direction.value, ...rotFlip);
            direction.value = parseInt(state);
          } else if (groundSignDir) {
            const state = this.transformMapping(mappings.groundSignDirectionMap, groundSignDir.value, ...rotFlip);
            groundSignDir.value = parseInt(state);
          } else if (torchFacingDir) {
            const state = this.transformMapping(mappings.torchMap, torchFacingDir.value, ...rotFlip);
            torchFacingDir.value = state;
          } else if (leverDir) {
            const state = this.transformMapping(mappings.leverMap, leverDir.value, ...rotFlip);
            leverDir.value = state.replace("0", "");
          } else if (pillarAxis) {
            const state = this.transformMapping(mappings.pillarAxisMap, pillarAxis.value + "_0", ...rotFlip);
            pillarAxis.value = state[0];
          } else if (topSlotBit) {
            const state = this.transformMapping(mappings.topSlotMap, String(topSlotBit.value), ...rotFlip);
            topSlotBit.value = state == "true";
          }
          return newBlock;
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
            .mul(rotFlip[1]).sub(bounds[0]).toBlock();
        }

        blockLoc = blockLoc.offset(loc.x, loc.y, loc.z);
        if (block instanceof BlockPermutation) {
          dim.getBlock(blockLoc).setPermutation(transform(block));
        } else {
          this.loadBlockFromStruct(block[0], blockLoc, dim);
          dim.getBlock(blockLoc).setPermutation(transform(block[1]));
        }
        if (iterateChunk()) yield i / this.blocks.size;
        i++;
      }

      if (this.savedEntities) {
        const onEntityload = (ev: EntityCreateEvent) => {
          if (shouldTransform) {
            // FIXME: Not properly aligned
            let entityLoc = ev.entity.location;
            let entityFacing = Vector.from(ev.entity.viewVector).add(entityLoc).toLocation();

            entityLoc = Vector.from(entityLoc).sub(loc)
              .rotateY(rotFlip[0].y).rotateX(rotFlip[0].x).rotateZ(rotFlip[0].z)
              .mul(rotFlip[1]).sub(bounds[0]).add(loc).toLocation();
            entityFacing = Vector.from(entityFacing).sub(loc)
              .rotateY(rotFlip[0].y).rotateX(rotFlip[0].x).rotateZ(rotFlip[0].z)
              .mul(rotFlip[1]).sub(bounds[0]).add(loc).toLocation();

            ev.entity.teleportFacing(entityLoc, dim, entityFacing);
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
      yield 1;
      return Server.structure.load(this.id, loc, dim, loadOptions);
    }
  }

  public getSize() {
    return this.size;
  }

  public getBlockCount() {
    return this.blockCount;
  }

  // TODO: Implement
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public getBlock() {

  }

  public getBlocks() {
    return Array.from(this.blocks.values());
  }

  public setBlock(loc: BlockLocation, block: Block | BlockPermutation, options?: StructureSaveOptions & {loc?: BlockLocation, dim?: Dimension}) {
    let error = false;
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
    this.size = Vector.max(this.size, Vector.from(loc).add(1)).toBlock();
    this.blockCount = this.blocks.size;
    return error;
  }

  public delete() {
    const thread = new Thread();
    thread.start(function* (self: RegionBuffer) {
      if (self.isAccurate) {
        for (const block of self.blocks.values()) {
          if (!(block instanceof BlockPermutation)) {
            self.deleteBlockStruct(block[0]);
            yield;
          }
        }
        self.blocks.clear();
      }
      Server.structure.delete(self.id);
      contentLog.debug("deleted structure", self.id);
    }, this);
  }

  private transformMapping(mapping: {[key: string|number]: Vector}, state: string|number, rotate: Vector, flip: Vector): string {
    let vec = mapping[state];
    if (!vec) {
      contentLog.debug(`failed to map state "${state}"!`);
      return typeof(state) == "string" ? state : state.toString();
    }
    vec = vec.rotateY(rotate.y).rotateX(rotate.x).rotateZ(rotate.z);
    vec = vec.mul(flip);

    let closestState: string;
    let closestDot = -1000;
    for (const newState in mapping) {
      const dot = mapping[newState].dot(vec);
      if (dot > closestDot) {
        closestState = newState;
        closestDot = dot;
      }
    }

    return closestState;
  }

  private saveBlockAsStruct(id: string, loc: BlockLocation, dim: Dimension) {
    const locStr = `${loc.x} ${loc.y} ${loc.z}`;
    Server.runCommand(`structure save ${id} ${locStr} ${locStr} false memory`, dim);
  }

  private loadBlockFromStruct(id: string, loc: BlockLocation, dim: Dimension) {
    const locStr = `${loc.x} ${loc.y} ${loc.z}`;
    return Server.runCommand(`structure load ${id} ${locStr}`, dim).error;
  }

  private deleteBlockStruct(id: string) {
    return Server.runCommand(`structure load ${id}`);
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
    down : new Vector( 0,-1, 0),
    up   : new Vector( 0, 1, 0),
    south: new Vector( 0, 0,-1),
    north: new Vector( 0, 0, 1),
    east : new Vector(-1, 0, 0),
    west : new Vector( 1, 0, 0)
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