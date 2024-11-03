import {
    contentLog,
    generateId,
    iterateChunk,
    Matrix,
    regionCenter,
    regionIterateBlocks,
    regionSize,
    regionTransformedBounds,
    regionVolume,
    Server,
    sleep,
    StructureLoadOptions,
    StructureSaveOptions,
    Thread,
    Vector,
} from "@notbeer-api";
import { Block, BlockPermutation, Dimension, Vector3 } from "@minecraft/server";
import { blockHasNBTData, getViewVector, locToString, stringToLoc } from "../util.js";
import { EntityCreateEvent } from "library/@types/Events.js";
import { Mask } from "./mask.js";
import { JobFunction, Jobs } from "./jobs.js";

export interface RegionLoadOptions {
    offset?: Vector;
    rotation?: Vector;
    flip?: Vector;
    mask?: Mask;
}

type blockData = [BlockPermutation, boolean] | [BlockPermutation, boolean, string];
type blockList = Vector3[] | ((loc: Block) => boolean | BlockPermutation) | "all";

interface transformContext {
    blockData: blockData;
    sampleBlock: (loc: Vector) => blockData;
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

    private refCount = 1;

    constructor(isAccurate = false) {
        this.isAccurate = isAccurate;
        this.id = "wedit:buffer_" + generateId();
        contentLog.debug("creating structure", this.id);
    }

    public *save(start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}, blocks: blockList = "all"): Generator<JobFunction | Promise<unknown>, boolean> {
        if (this.isAccurate) {
            const min = Vector.min(start, end);
            const iterate = (block: Block) => {
                const relLoc = Vector.sub(block, min).floor();
                if (blockHasNBTData(block)) {
                    const id = this.id + "_" + this.subId++;
                    this.saveBlockAsStruct(id, block, dim);
                    this.blocks.set(locToString(relLoc), [block.permutation, block.isWaterlogged, id]);
                } else {
                    this.blocks.set(locToString(relLoc), [block.permutation, block.isWaterlogged]);
                }
            };

            let count = 0;
            const isFilter = typeof blocks == "function";
            if (blocks == "all" || isFilter) {
                const volume = regionVolume(start, end);
                let i = 0;
                for (const loc of regionIterateBlocks(start, end)) {
                    let block = dim.getBlock(loc);
                    while (!block && Jobs.inContext()) {
                        block = Jobs.loadBlock(loc);
                        yield sleep(1);
                    }

                    if (!isFilter) {
                        iterate(block);
                        count++;
                    } else {
                        const filtered = blocks(block);
                        if (typeof filtered != "boolean") {
                            const relLoc = Vector.sub(block, min).floor();
                            this.blocks.set(locToString(relLoc), [filtered, false]);
                            count++;
                        } else if (filtered) {
                            iterate(block);
                            count++;
                        }
                    }
                    if (iterateChunk()) yield Jobs.setProgress(i / volume);
                    i++;
                }
            } else if (Array.isArray(blocks)) {
                for (let i = 0; i < blocks.length; i++) {
                    let block = dim.getBlock(blocks[i]);
                    while (!block && Jobs.inContext()) {
                        block = Jobs.loadBlock(blocks[i]);
                        yield sleep(1);
                    }
                    iterate(block);
                    if (iterateChunk()) yield Jobs.setProgress(i / blocks.length);
                }
                count = blocks.length;
            }
            this.blockCount = count;
            if (options.includeEntities) {
                Server.structure.save(this.id, start, end, dim, {
                    includeBlocks: false,
                    includeEntities: true,
                });
            }
        } else {
            const jobCtx = Jobs.getContext();
            if (
                yield Server.structure.saveWhileLoadingChunks(this.id, start, end, dim, options, (min, max) => {
                    if (Jobs.isContextValid(jobCtx)) {
                        Jobs.loadBlock(regionCenter(min, max), jobCtx);
                        return false;
                    }
                    return true;
                })
            )
                return true;
            this.blockCount = regionVolume(start, end);
        }
        this.imported = "";
        this.savedEntities = options.includeEntities;
        this.size = regionSize(start, end);
        return false;
    }

    public *load(loc: Vector3, dim: Dimension, options: RegionLoadOptions = {}): Generator<JobFunction | Promise<unknown>, void> {
        const rotation = options.rotation ?? Vector.ZERO;
        const flip = options.flip ?? Vector.ONE;
        const bounds = this.getBounds(loc, options);
        if (this.isAccurate) {
            const matrix = RegionBuffer.getTransformationMatrix(loc, options);
            const invMatrix = matrix.invert();
            const shouldTransform = options.rotation || options.flip;

            let transform: (block: BlockPermutation) => BlockPermutation;
            if (shouldTransform) {
                transform = (block) => {
                    const blockName = block.type.id;
                    const attachment = block.getState("attachment") as string;
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
                        for (const prop in properties) block = block.withState(<any>prop, properties[prop]);
                        return block;
                    };

                    if (upsideDownBit != null && openBit != null && direction != null) {
                        const states = (this.transformMapping(mappings.trapdoorMap, `${upsideDownBit}_${openBit}_${direction}`, matrix) as string).split("_");
                        block = withProperties({ upside_down_bit: states[0] == "true", open_bit: states[1] == "true", direction: parseInt(states[2]) });
                    } else if (weirdoDir != null && upsideDownBit != null) {
                        const states = (this.transformMapping(mappings.stairsMap, `${upsideDownBit}_${weirdoDir}`, matrix) as string).split("_");
                        block = withProperties({ upside_down_bit: states[0] == "true", weirdo_direction: parseInt(states[1]) });
                    } else if (doorHingeBit != null && direction != null) {
                        const states = (this.transformMapping(mappings.doorMap, `${doorHingeBit}_${direction}`, matrix) as string).split("_");
                        block = withProperties({ door_hinge_bit: states[0] == "true", direction: parseInt(states[1]) });
                    } else if (attachment != null && direction != null) {
                        const states = (this.transformMapping(mappings.bellMap, `${attachment}_${direction}`, matrix) as string).split("_");
                        block = withProperties({ attachment: states[0], direction: parseInt(states[1]) });
                    } else if (cardinalDir != null) {
                        const state = this.transformMapping(mappings.cardinalDirectionMap, cardinalDir, matrix);
                        block = block.withState("minecraft:cardinal_direction", state);
                    } else if (facingDir != null) {
                        const state = this.transformMapping(mappings.facingDirectionMap, facingDir, matrix);
                        block = block.withState("facing_direction", parseInt(state));
                    } else if (direction != null) {
                        const mapping = blockName.includes("powered_repeater") || blockName.includes("powered_comparator") ? mappings.redstoneMap : mappings.directionMap;
                        const state = this.transformMapping(mapping, direction, matrix);
                        block = block.withState("direction", parseInt(state));
                    } else if (groundSignDir != null) {
                        const state = this.transformMapping(mappings.groundSignDirectionMap, groundSignDir, matrix);
                        block = block.withState("ground_sign_direction", parseInt(state));
                    } else if (torchFacingDir != null) {
                        const state = this.transformMapping(mappings.torchMap, torchFacingDir, matrix);
                        block = block.withState("torch_facing_direction", state);
                    } else if (leverDir != null) {
                        const state = this.transformMapping(mappings.leverMap, leverDir, matrix);
                        block = block.withState("lever_direction", state.replace("0", ""));
                    } else if (pillarAxis != null) {
                        const state = this.transformMapping(mappings.pillarAxisMap, pillarAxis + "_0", matrix);
                        block = block.withState("pillar_axis", state[0]);
                    } else if (topSlotBit != null) {
                        const state = this.transformMapping(mappings.topSlotMap, String(topSlotBit), matrix);
                        block = block.withState("top_slot_bit", state == "true");
                    }
                    return block;
                };
            } else {
                transform = (block) => block;
            }

            const blocks = this.blocks;
            let totalIterationCount = 0;
            const iterator = function* (): Generator<[Vector3, blockData | undefined]> {
                if (rotation.x % 90 || rotation.y % 90 || rotation.z % 90) {
                    totalIterationCount = regionVolume(...bounds);
                    for (const blockLoc of regionIterateBlocks(...bounds)) {
                        const sample = Vector.from(blockLoc).add(0.5).transform(invMatrix).floor();
                        const block = blocks.get(locToString(sample));
                        yield [blockLoc, block];
                    }
                } else {
                    totalIterationCount = blocks.size;
                    for (const [key, block] of blocks.entries()) {
                        let blockLoc = stringToLoc(key);
                        blockLoc = (shouldTransform ? blockLoc.add(0.5).transform(matrix) : blockLoc.add(loc)).floor();
                        yield [blockLoc, block];
                    }
                }
            };

            let i = 0;
            for (const [blockLoc, block] of iterator()) {
                if (iterateChunk()) yield Jobs.setProgress(i / totalIterationCount);
                i++;
                if (!block) continue;

                let oldBlock = dim.getBlock(blockLoc);
                while (!oldBlock && Jobs.inContext()) {
                    oldBlock = Jobs.loadBlock(blockLoc);
                    yield sleep(1);
                }
                if (options.mask && !options.mask.matchesBlock(oldBlock)) continue;

                if (block.length === 3) this.loadBlockFromStruct(block[2], blockLoc, dim);
                oldBlock.setPermutation(transform(block[0]));
                oldBlock.setWaterlogged(block[1]);
            }

            if (this.savedEntities) {
                const onEntityload = (ev: EntityCreateEvent) => {
                    if (shouldTransform) {
                        // FIXME: Not properly aligned
                        let entityLoc = ev.entity.location;
                        let entityFacing = Vector.from(getViewVector(ev.entity)).add(entityLoc);

                        entityLoc = Vector.from(entityLoc).sub(loc).transform(matrix).add(loc);
                        entityFacing = Vector.from(entityFacing).sub(loc).transform(matrix).add(loc);

                        ev.entity.teleport(entityLoc, {
                            dimension: dim,
                            facingLocation: entityFacing,
                        });
                    }
                };

                Server.on("entityCreate", onEntityload);
                Server.structure.load(this.id, loc, dim);
                Server.off("entityCreate", onEntityload);
            }
        } else {
            const loadOptions: StructureLoadOptions = { rotation: rotation.y, flip: "none" };
            if (flip.z == -1) loadOptions.flip = "x";
            if (flip.x == -1) loadOptions.flip += "z";
            if ((loadOptions.flip as string) == "nonez") loadOptions.flip = "z";
            if (this.imported) loadOptions.importedSize = Vector.from(this.size);
            const jobCtx = Jobs.getContext();
            yield Server.structure.loadWhileLoadingChunks(this.imported || this.id, bounds[0], dim, loadOptions, (min, max) => {
                if (Jobs.isContextValid(jobCtx)) {
                    Jobs.loadBlock(regionCenter(min, max), jobCtx);
                    return false;
                }
                return true;
            });
        }
    }

    /**
     * @param func
     * @returns
     */
    public *warp(func: (loc: Vector3, ctx: transformContext) => blockData): Generator<number, null> {
        if (!this.isAccurate) return;

        const region: [Vector, Vector] = [Vector.ZERO.floor(), this.size.sub(-1)];
        const output = new Map();
        const volume = regionVolume(...region);
        const sampleBlock = (loc: Vector) => this.blocks.get(locToString(loc));

        let i = 0;
        for (const coord of regionIterateBlocks(...region)) {
            const block = func(coord, {
                blockData: this.blocks.get(locToString(coord)),
                sampleBlock,
            });
            if (block) output.set(locToString(coord), block);
            yield ++i / volume;
        }

        this.blocks = output;
        this.blockCount = this.blocks.size;
    }

    public *create(start: Vector3, end: Vector3, func: (loc: Vector3) => Block | BlockPermutation): Generator<JobFunction, null> {
        if (!this.isAccurate || !this.size.equals(Vector.ZERO)) return;

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
                    this.blocks.set(locToString(coord), [block.permutation, block.isWaterlogged, id]);
                } else {
                    this.blocks.set(locToString(coord), block instanceof Block ? [block.permutation, block.isWaterlogged] : [block, false]);
                }
            }
            yield Jobs.setProgress(++i / volume);
        }
        this.blockCount = this.blocks.size;
    }

    public getSize() {
        return this.size;
    }

    public getBounds(loc: Vector3, options: RegionLoadOptions = {}) {
        return RegionBuffer.createBounds(loc, Vector.add(loc, this.size).sub(1), options);
    }

    public getBlockCount() {
        return this.blockCount;
    }

    public getBlock(loc: Vector) {
        if (!this.isAccurate) return null;
        const block = this.blocks.get(locToString(loc));
        if (block) return block[0];
    }

    public getBlocks() {
        return Array.from(this.blocks.values());
    }

    public setBlock(loc: Vector3, block: Block | BlockPermutation, options?: StructureSaveOptions & { loc?: Vector; dim?: Dimension }) {
        let error: boolean;
        const key = locToString(loc);

        if (this.blocks.has(key) && Array.isArray(this.blocks.get(key))) {
            this.deleteBlockStruct((this.blocks.get(key) as [BlockPermutation, boolean, string])[2]);
        }

        if (block instanceof BlockPermutation) {
            if (options?.includeEntities) {
                const id = this.id + "_" + this.subId++;
                error = Server.structure.save(id, options.loc, options.loc, options.dim, options);
                this.blocks.set(key, [block, false, id]);
            } else {
                this.blocks.set(key, [block, false]);
            }
        } else {
            const id = this.id + "_" + this.subId++;
            error = Server.structure.save(id, block.location, block.location, block.dimension, options);
            this.blocks.set(key, [block.permutation, block.isWaterlogged, id]);
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

    public ref() {
        this.refCount++;
    }

    public deref() {
        if (--this.refCount < 1) this.delete();
    }

    public static createBounds(start: Vector3, end: Vector3, options: RegionLoadOptions = {}) {
        return regionTransformedBounds(Vector.ZERO, Vector.sub(end, start).floor(), RegionBuffer.getTransformationMatrix(start, options));
    }

    private static getTransformationMatrix(loc: Vector3, options: RegionLoadOptions = {}) {
        const offset = Matrix.fromTranslation(options.offset ?? Vector.ZERO);
        return Matrix.fromRotationFlipOffset(options.rotation ?? Vector.ZERO, options.flip ?? Vector.ONE)
            .multiply(offset)
            .translate(loc);
    }

    private transformMapping(mapping: { [key: string | number]: Vector | [number, number, number] }, state: string | number, transform: Matrix): string {
        let vec = Vector.from(mapping[state]);
        if (!vec) {
            contentLog.debug(`Can't map state "${state}".`);
            return typeof state == "string" ? state : state.toString();
        }
        vec = vec.transformDirection(transform);

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

    private delete() {
        const thread = new Thread();
        thread.start(function* (self: RegionBuffer) {
            if (self.isAccurate) {
                const promises = [];
                for (const block of self.blocks.values()) {
                    if (block.length === 3) {
                        promises.push(self.deleteBlockStruct(block[2]));
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
}

const mappings = {
    topSlotMap: {
        // upside_down_bit
        false: new Vector(0, 1, 0),
        true: new Vector(0, -1, 0),
    },
    redstoneMap: {
        0: new Vector(0, 0, -1),
        1: new Vector(1, 0, 0),
        2: new Vector(0, 0, 1),
        3: new Vector(-1, 0, 0),
    },
    directionMap: {
        // direction
        0: new Vector(1, 0, 0),
        1: new Vector(0, 0, 1),
        2: new Vector(-1, 0, 0),
        3: new Vector(0, 0, -1),
    },
    facingDirectionMap: {
        // facing_direction
        0: new Vector(0, -1, 0),
        1: new Vector(0, 1, 0),
        2: new Vector(0, 0, -1),
        3: new Vector(0, 0, 1),
        4: new Vector(-1, 0, 0),
        5: new Vector(1, 0, 0),
    },
    cardinalDirectionMap: {
        // minecraft:cardinal_direction
        north: new Vector(0, 0, -1),
        south: new Vector(0, 0, 1),
        west: new Vector(-1, 0, 0),
        east: new Vector(1, 0, 0),
    },
    pillarAxisMap: {
        // pillar_axis
        x_0: new Vector(1, 0, 0),
        y_0: new Vector(0, 1, 0),
        z_0: new Vector(0, 0, 1),
        x_1: new Vector(-1, 0, 0),
        y_1: new Vector(0, -1, 0),
        z_1: new Vector(0, 0, -1),
    },
    groundSignDirectionMap: {
        // ground_sign_direction
        0: new Vector(0, 0, 1),
        1: new Vector(0, 0, 1).rotate((1 / 16) * 360, "y"),
        2: new Vector(0, 0, 1).rotate((2 / 16) * 360, "y"),
        3: new Vector(0, 0, 1).rotate((3 / 16) * 360, "y"),
        4: new Vector(0, 0, 1).rotate((4 / 16) * 360, "y"),
        5: new Vector(0, 0, 1).rotate((5 / 16) * 360, "y"),
        6: new Vector(0, 0, 1).rotate((6 / 16) * 360, "y"),
        7: new Vector(0, 0, 1).rotate((7 / 16) * 360, "y"),
        8: new Vector(0, 0, 1).rotate((8 / 16) * 360, "y"),
        9: new Vector(0, 0, 1).rotate((9 / 16) * 360, "y"),
        10: new Vector(0, 0, 1).rotate((10 / 16) * 360, "y"),
        11: new Vector(0, 0, 1).rotate((11 / 16) * 360, "y"),
        12: new Vector(0, 0, 1).rotate((12 / 16) * 360, "y"),
        13: new Vector(0, 0, 1).rotate((13 / 16) * 360, "y"),
        14: new Vector(0, 0, 1).rotate((14 / 16) * 360, "y"),
        15: new Vector(0, 0, 1).rotate((15 / 16) * 360, "y"),
    },
    stairsMap: {
        // upside_down_bit - weirdo_direction
        false_0: new Vector(-1, 1, 0),
        false_1: new Vector(1, 1, 0),
        false_2: new Vector(0, 1, -1),
        false_3: new Vector(0, 1, 1),
        true_0: new Vector(-1, -1, 0),
        true_1: new Vector(1, -1, 0),
        true_2: new Vector(0, -1, -1),
        true_3: new Vector(0, -1, 1),
    },
    torchMap: {
        // torch_facing_direction
        north: new Vector(0, 0, 1),
        east: new Vector(-1, 0, 0),
        south: new Vector(0, 0, -1),
        west: new Vector(1, 0, 0),
        top: new Vector(0, 1, 0),
    },
    leverMap: {
        // lever_direction
        north: new Vector(0, 0, 1),
        east: new Vector(-1, 0, 0),
        south: new Vector(0, 0, -1),
        west: new Vector(1, 0, 0),
        up_north_south: new Vector(0, 1, 0.5),
        up_north_south0: new Vector(0, 1, -0.5),
        up_east_west: new Vector(0.5, 1, 0),
        up_east_west0: new Vector(-0.5, 1, 0),
        down_north_south: new Vector(0, -1, 0.5),
        down_north_south0: new Vector(0, -1, -0.5),
        down_east_west: new Vector(0.5, -1, 0),
        down_east_west0: new Vector(-0.5, -1, 0),
    },
    doorMap: {
        // door_hinge_bit - direction
        false_0: new Vector(1, 0, 0.5),
        false_1: new Vector(-0.5, 0, 1),
        false_2: new Vector(-1, 0, -0.5),
        false_3: new Vector(0.5, 0, -1),
        true_0: new Vector(1, 0, -0.5),
        true_1: new Vector(0.5, 0, 1),
        true_2: new Vector(-1, 0, 0.5),
        true_3: new Vector(-0.5, 0, -1),
    },
    bellMap: {
        // attachment - direction
        standing_0: new Vector(1, 0.5, 0),
        standing_1: new Vector(0, 0.5, 1),
        standing_2: new Vector(-1, 0.5, 0),
        standing_3: new Vector(0, 0.5, -1),
        side_0: new Vector(1, 0, 0),
        side_1: new Vector(0, 0, 1),
        side_2: new Vector(-1, 0, 0),
        side_3: new Vector(0, 0, -1),
        hanging_0: new Vector(1, -0.5, 0),
        hanging_1: new Vector(0, -0.5, 1),
        hanging_2: new Vector(-1, -0.5, 0),
        hanging_3: new Vector(0, -0.5, -1),
    },
    trapdoorMap: {
        // upside_down_bit - open_bit - direction
        false_false_0: new Vector(-0.5, 1, 0),
        false_false_1: new Vector(0.5, 1, 0),
        false_false_2: new Vector(0, 1, -0.5),
        false_false_3: new Vector(0, 1, 0.5),
        true_false_0: new Vector(-0.5, -1, 0),
        true_false_1: new Vector(0.5, -1, 0),
        true_false_2: new Vector(0, -1, -0.5),
        true_false_3: new Vector(0, -1, 0.5),
        false_true_0: new Vector(-1, 0.5, 0),
        false_true_1: new Vector(1, 0.5, 0),
        false_true_2: new Vector(0, 0.5, -1),
        false_true_3: new Vector(0, 0.5, 1),
        true_true_0: new Vector(-1, -0.5, 0),
        true_true_1: new Vector(1, -0.5, 0),
        true_true_2: new Vector(0, -0.5, -1),
        true_true_3: new Vector(0, -0.5, 1),
    },
    // TODO: Support glow lychen
} as const;
