import { axis, contentLog, generateId, iterateChunk, Matrix, regionIterateBlocks, regionSize, regionTransformedBounds, regionVolume, Thread, Vector } from "@notbeer-api";
import { Block, BlockPermutation, BlockType, Dimension, Structure, StructureMirrorAxis, StructureRotation, StructureSaveMode, Vector3, VectorXZ, world } from "@minecraft/server";
import { blockHasNBTData, locToString, stringToLoc, wrap } from "../util.js";
import { Mask } from "./mask.js";
import { JobFunction, Jobs } from "./jobs.js";

export interface RegionSaveOptions {
    saveAs?: string;
    includeEntities?: boolean;
    recordBlocksWithData?: boolean;
    modifier?: (block: Block) => boolean | BlockPermutation;
}

export interface RegionLoadOptions {
    offset?: Vector;
    rotation?: Vector;
    flip?: Vector;
    mask?: Mask;
}

export interface RegionBlock {
    /**
     * @remarks
     * Returns the buffer that the block is within.
     */
    readonly buffer: RegionBuffer;
    /**
     * @remarks
     * Returns true if this block is an air block (i.e., empty
     * space).
     */
    readonly isAir: boolean;
    /**
     * @remarks
     * Returns true if this block is a liquid block - (e.g., a
     * water block and a lava block are liquid, while an air block
     * and a stone block are not. Water logged blocks are not
     * liquid blocks).
     */
    readonly isLiquid: boolean;
    /**
     * @beta
     * @remarks
     * Returns or sets whether this block has a liquid on it.
     */
    readonly isWaterlogged: boolean;
    /**
     * @remarks
     * Coordinates of the specified block.
     */
    readonly location: Vector3;
    /**
     * @remarks
     * Additional block configuration data that describes the
     * block.
     */
    readonly permutation: BlockPermutation | undefined;
    /**
     * @remarks
     * Structure representation of the block. Only exists if
     * the block contains extra data like items and text.
     */
    readonly nbtStructure: Structure | undefined;
    /**
     * @remarks
     * Gets the type of block.
     */
    readonly type: BlockType;
    /**
     * @remarks
     * Identifier of the type of block for this block. Warning:
     * Vanilla block names can be changed in future releases, try
     * using 'Block.matches' instead for block comparison.
     */
    readonly typeId: string;
    /**
     * @remarks
     * X coordinate of the block.
     */
    readonly x: number;
    /**
     * @remarks
     * Y coordinate of the block.
     */
    readonly y: number;
    /**
     * @remarks
     * Z coordinate of the block.
     */
    readonly z: number;
    /**
     * @remarks
     * Returns the {@link RegionBlock} above this block (positive in the
     * Y direction).
     *
     * @param steps
     * Number of steps above to step before returning.
     */
    above(steps?: number): RegionBlock | undefined;
    /**
     * @remarks
     * Returns the {@link RegionBlock} below this block (negative in the
     * Y direction).
     *
     * @param steps
     * Number of steps below to step before returning.
     */
    below(steps?: number): RegionBlock | undefined;
    /**
     * @remarks
     * Returns the {@link Vector3} of the center of this block on
     * the X and Z axis.
     */
    bottomCenter(): Vector3;
    /**
     * @remarks
     * Returns the {@link Vector3} of the center of this block on
     * the X, Y, and Z axis.
     */
    center(): Vector3;
    /**
     * @remarks
     * Returns the {@link RegionBlock} to the east of this block
     * (positive in the X direction).
     *
     * @param steps
     * Number of steps to the east to step before returning.
     */
    east(steps?: number): RegionBlock | undefined;
    /**
     * @remarks
     * Returns a set of tags for a block.
     *
     * @returns
     * The list of tags that the block has.
     */
    getTags(): string[];
    /**
     * @remarks
     * Checks to see if the permutation of this block has a
     * specific tag.
     *
     * @param tag
     * Tag to check for.
     * @returns
     * Returns `true` if the permutation of this block has the tag,
     * else `false`.
     */
    hasTag(tag: string): boolean;
    /**
     * @remarks
     * Tests whether this block matches a specific criteria.
     *
     * @param blockName
     * Block type identifier to match this API against.
     * @param states
     * Optional set of block states to test this block against.
     * @returns
     * Returns true if the block matches the specified criteria.
     */
    matches(blockName: string, states?: Record<string, boolean | number | string>): boolean;
    /**
     * @remarks
     * Returns the {@link RegionBlock} to the north of this block
     * (negative in the Z direction).
     *
     * @param steps
     * Number of steps to the north to step before returning.
     */
    north(steps?: number): RegionBlock | undefined;
    /**
     * @remarks
     * Returns a block at an offset relative vector to this block.
     *
     * @param offset
     * The offset vector. For example, an offset of 0, 1, 0 will
     * return the block above the current block.
     * @returns
     * Block at the specified offset, or undefined if that block
     * could not be retrieved (for example, the block and its
     * relative chunk is not loaded yet.)
     */
    offset(offset: Vector3): RegionBlock | undefined;
    /**
     * @remarks
     * Sets the block in the dimension to the state of the
     * permutation.
     *
     * This function can't be called in read-only mode.
     *
     * @param permutation
     * Permutation that contains a set of property states for the
     * Block.
     */
    setPermutation(permutation: BlockPermutation): void;
    /**
     * @remarks
     * Sets the type of block.
     *
     * This function can't be called in read-only mode.
     *
     * @param blockType
     * Identifier of the type of block to apply - for example,
     * minecraft:powered_repeater.
     */
    setType(blockType: BlockType | string): void;
    /**
     * @remarks
     * Returns the {@link RegionBlock} to the south of this block
     * (positive in the Z direction).
     *
     * @param steps
     * Number of steps to the south to step before returning.
     */
    south(steps?: number): RegionBlock | undefined;
    /**
     * @remarks
     * Returns the {@link RegionBlock} to the west of this block
     * (negative in the X direction).
     *
     * @param steps
     * Number of steps to the west to step before returning.
     */
    west(steps?: number): RegionBlock | undefined;
}

interface SubStructure {
    name: string;
    structure: Structure;
    start: Vector;
    end: Vector;
}

export class RegionBuffer {
    private static readonly MAX_SIZE: Vector = new Vector(64, 256, 64);

    public readonly id: string;
    public readonly getBlock: (loc: Vector3) => RegionBlock | undefined;

    private structure: Structure | undefined;
    private readonly structures: Record<string, Structure> = {};
    private readonly extraBlockData: Record<string, Structure> = {};

    private size = Vector.ZERO;
    private volume = 0;
    private refCount = 1;

    static *create(start: Vector3, end: Vector3, func: (loc: Vector3) => Block | BlockPermutation | undefined): Generator<JobFunction | Promise<unknown>, RegionBuffer> {
        const min = Vector.min(start, end);
        const size = Vector.from(regionSize(start, end));

        const buffer = yield* this.saveStructs(undefined, start, end, (name, start, end) => world.structureManager.createEmpty(name, regionSize(start, end)));
        if (!buffer) return undefined;

        const volume = regionVolume(start, end);
        buffer.volume = volume;
        buffer.size = size;

        let i = 0;
        for (const loc of regionIterateBlocks(start, end)) {
            const localLoc = Vector.sub(loc, min);
            const block = func(localLoc);

            if (block) buffer.getBlock(localLoc).setPermutation(block instanceof BlockPermutation ? block : block.permutation);
            if (block instanceof Block && blockRecordable(block)) {
                const locString = locToString(localLoc);
                const name = buffer.id + "_block" + locString;
                world.structureManager.delete(name);
                buffer.extraBlockData[locString] = world.structureManager.createFromWorld(name, block.dimension, loc, loc, { includeEntities: false, saveMode: StructureSaveMode.Memory });
            }

            if (iterateChunk()) yield Jobs.setProgress(i / volume);
            i++;
        }
        return buffer;
    }

    static *createFromWorld(start: Vector3, end: Vector3, dim: Dimension, options: RegionSaveOptions = {}): Generator<JobFunction | Promise<unknown>, RegionBuffer> {
        const min = Vector.min(start, end);
        const size = Vector.from(regionSize(start, end));
        const saveOptions = { includeEntities: options.includeEntities ?? false, saveMode: StructureSaveMode[options.saveAs ? "World" : "Memory"] };

        const buffer = yield* this.saveStructs(options.saveAs, start, end, (name, start, end) => world.structureManager.createFromWorld(name, dim, start, end, saveOptions));
        if (!buffer) return undefined;
        buffer.volume = regionVolume(start, end);
        buffer.size = size;

        if (options.recordBlocksWithData || options.modifier) {
            let i = 0;
            const volume = regionVolume(start, end);
            const modifier = options.modifier ?? (() => true);
            for (const loc of regionIterateBlocks(start, end)) {
                const block = dim.getBlock(loc) ?? (yield* Jobs.loadBlock(loc));
                const modResult = modifier(block);
                const localLoc = Vector.sub(loc, min);
                // Explicitly compare it to "true" since it could succeed with a block permutation
                if (modResult === true) {
                    if (options.recordBlocksWithData && blockRecordable(block)) {
                        const locString = locToString(localLoc);
                        const name = buffer.id + "_block" + locString;
                        world.structureManager.delete(name);
                        buffer.extraBlockData[locString] = world.structureManager.createFromWorld(name, dim, loc, loc, { includeEntities: false });
                    }
                } else {
                    buffer.getBlock(localLoc).setPermutation(!modResult ? undefined : modResult);
                }

                if (iterateChunk()) yield Jobs.setProgress(i / volume);
                i++;
            }
        }

        return buffer;
    }

    static get(name: string): RegionBuffer | undefined {
        let structure: Structure;
        if ((structure = world.structureManager.get(name))) {
            const buffer = new RegionBuffer(name, false);
            buffer.structure = structure;
            buffer.volume = structure.size.x * structure.size.y * structure.size.z;
            buffer.size = Vector.from(structure.size);
            return buffer;
        } else if ((structure = world.structureManager.get(name + "_" + locToString(Vector.ZERO)))) {
            const maxIdx = Vector.ZERO;
            for (const axis of <axis[]>["x", "y", "z"]) {
                while ((structure = world.structureManager.get(name + "_" + locToString(maxIdx)))) maxIdx[axis]++;
                maxIdx[axis]--;
            }
            const size = maxIdx.mul(this.MAX_SIZE).add(structure.size);
            const buffer = new RegionBuffer(name, true);
            Array.from(Object.entries(this.getSubStructs(name, size))).forEach(([key, sub]) => (buffer.structures[key] = sub.structure));
            buffer.volume = size.x * size.y * size.z;
            buffer.size = size;
            return buffer;
        }
    }

    private constructor(id: string | undefined, multipleStructures: boolean) {
        contentLog.debug("creating structure", this.id);
        this.id = id ?? "wedit:buffer_" + generateId();
        if (multipleStructures) this.getBlock = this.getBlockMulti;
        else this.getBlock = this.getBlockSingle;
    }

    public *load(loc: Vector3, dim: Dimension, options: RegionLoadOptions = {}): Generator<JobFunction | Promise<unknown>, void> {
        const rotation = options.rotation ?? Vector.ZERO;
        const flip = options.flip ?? Vector.ONE;
        const bounds = this.getBounds(loc, options);

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

        if ((Math.abs(rotation.y) / 90) % 1 != 0 || rotation.x || rotation.z || flip.y != 1 || options.mask) {
            let i = 0;
            const totalIterationCount = regionVolume(...bounds);
            for (const blockLoc of regionIterateBlocks(...bounds)) {
                const sample = Vector.from(blockLoc).add(0.5).transform(invMatrix).floor();
                const block = this.getBlock(sample);

                if (iterateChunk()) yield Jobs.setProgress(i / totalIterationCount);
                i++;
                if (!block?.permutation) continue;

                let oldBlock = dim.getBlock(blockLoc);
                if (!oldBlock && Jobs.inContext()) oldBlock = yield* Jobs.loadBlock(blockLoc);
                if (options.mask && !options.mask.matchesBlock(oldBlock)) continue;

                if (block.nbtStructure) world.structureManager.place(block.nbtStructure, dim, blockLoc);
                oldBlock.setPermutation(transform(block.permutation));
            }

            const volumeQuery = { location: loc, volume: Vector.sub(this.size, [1, 1, 1]) };
            const oldEntities = dim.getEntities(volumeQuery);
            yield* this.loadStructs(loc, dim, { includeBlocks: false });

            if (shouldTransform) {
                dim.getEntities(volumeQuery)
                    .filter((entity) => !oldEntities.some((old) => old.id === entity.id))
                    .forEach((entity) => {
                        let location = entity.location;
                        let facingLocation = Vector.add(entity.getViewDirection(), location);
                        location = Vector.from(location).sub(loc).transform(matrix).add(loc);
                        facingLocation = Vector.from(facingLocation).sub(loc).transform(matrix).add(loc);
                        entity.teleport(location, { dimension: dim, facingLocation });
                    });
            }
        } else {
            yield* this.loadStructs(bounds[0], dim, { rotation: rotation.y, flip });

            let i = 0;
            const totalIterationCount = Object.keys(this.extraBlockData).length;
            for (const key in this.extraBlockData) {
                let blockLoc = stringToLoc(key);
                blockLoc = (shouldTransform ? Vector.add(blockLoc, 0.5).transform(matrix) : Vector.add(blockLoc, loc)).floor();

                if (iterateChunk()) yield Jobs.setProgress(i / totalIterationCount);
                i++;

                let oldBlock = dim.getBlock(blockLoc);
                if (!oldBlock && Jobs.inContext()) oldBlock = yield* Jobs.loadBlock(blockLoc);
                world.structureManager.place(this.extraBlockData[key], dim, blockLoc);
                oldBlock.setPermutation(transform(oldBlock.permutation));
            }
        }
    }

    public getSize() {
        return this.size;
    }

    public getBounds(loc: Vector3, options: RegionLoadOptions = {}) {
        return RegionBuffer.createBounds(loc, Vector.add(loc, this.size).sub(1), options);
    }

    public getVolume() {
        return this.volume;
    }

    public *getBlocks() {
        for (const loc of regionIterateBlocks(Vector.ZERO, Vector.sub(this.size, [1, 1, 1]))) yield this.getBlock(loc);
    }

    public ref() {
        this.refCount++;
    }

    public deref() {
        if (--this.refCount < 1) this.delete();
    }

    private getBlockSingle(loc: Vector3) {
        if (loc.x < 0 || loc.x >= this.size.x || loc.y < 0 || loc.y >= this.size.y || loc.z < 0 || loc.z >= this.size.z) return undefined;
        return new RegionBlockImpl(this, this.extraBlockData, loc, this.structure, loc);
    }

    private getBlockMulti(loc: Vector3) {
        if (loc.x < 0 || loc.x >= this.size.x || loc.y < 0 || loc.y >= this.size.y || loc.z < 0 || loc.z >= this.size.z) return undefined;
        const offset = { x: Math.floor(loc.x / RegionBuffer.MAX_SIZE.x), y: Math.floor(loc.y / RegionBuffer.MAX_SIZE.y), z: Math.floor(loc.z / RegionBuffer.MAX_SIZE.z) };
        const structure = this.structures[locToString(offset)];
        return new RegionBlockImpl(this, this.extraBlockData, loc, structure, Vector.sub(loc, Vector.mul(offset, RegionBuffer.MAX_SIZE)));
    }

    private *loadStructs(loc: Vector3, dim: Dimension, options: { rotation?: number; flip?: VectorXZ; includeBlocks?: boolean } = {}) {
        const loadPos = Vector.from(loc);
        const rotation = new Vector(0, options.rotation ?? 0, 0);
        const mirror = new Vector(Math.sign(options.flip?.x ?? 1), 1, Math.sign(options.flip?.z ?? 1));
        const loadOptions = {
            rotation: {
                "0": StructureRotation.None,
                "1": StructureRotation.Rotate90,
                "2": StructureRotation.Rotate180,
                "3": StructureRotation.Rotate270,
            }[wrap((rotation.y ?? 0) / 90, 4)],
            mirror: {
                "1 1": StructureMirrorAxis.None,
                "-1 1": StructureMirrorAxis.Z,
                "1 -1": StructureMirrorAxis.X,
                "-1 -1": StructureMirrorAxis.XZ,
            }[<string>`${mirror.x} ${mirror.z}`],
            includeBlocks: options.includeBlocks ?? true,
        };

        if (!this.structure) {
            const size = this.size;
            const transform = Matrix.fromRotationFlipOffset(rotation, mirror);
            const bounds = regionTransformedBounds(Vector.ZERO, size.sub(1).floor(), transform);
            let error = false;
            for (const [key, structure] of Object.entries(this.structures)) {
                const offset = stringToLoc(key).mul(RegionBuffer.MAX_SIZE);
                const subBounds = regionTransformedBounds(offset, offset.add(structure.size).sub(1), transform);
                const subStart = Vector.sub(subBounds[0], bounds[0]).add(loadPos);
                const subEnd = Vector.sub(subBounds[1], bounds[0]).add(loadPos);
                yield* Jobs.loadArea(subStart, subEnd);
                try {
                    world.structureManager.place(structure, dim, subStart, loadOptions);
                } catch {
                    error = true;
                    break;
                }
            }
            return error;
        } else {
            yield* Jobs.loadArea(loc, Vector.add(loc, this.size).sub(1));
            try {
                world.structureManager.place(this.structure, dim, loadPos.floor(), loadOptions);
                return false;
            } catch {
                return true;
            }
        }
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

    private delete() {
        const thread = new Thread();
        thread.start(function* (self: RegionBuffer) {
            for (const structure of Object.values(self.extraBlockData)) world.structureManager.delete(structure), yield;
            for (const structure of Object.values(self.structures)) world.structureManager.delete(structure), yield;
            if (self.structure) world.structureManager.delete(self.structure);
            self.size = Vector.ZERO;
            self.volume = 0;
            contentLog.debug("deleted structure", self.id);
        }, this);
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

    private static *saveStructs(name: string | undefined, start: Vector3, end: Vector3, createFunc: (name: string, start: Vector3, end: Vector3) => Structure) {
        const min = Vector.min(start, end);
        const size = regionSize(start, end);
        if (RegionBuffer.beyondMaxSize(size)) {
            let error = false;
            const buffer = new RegionBuffer(name, true);
            for (const [key, sub] of Object.entries(this.getSubStructs(buffer.id, size))) {
                const subStart = min.add(sub.start);
                const subEnd = min.add(sub.end);
                yield* Jobs.loadArea(subStart, subEnd);
                try {
                    world.structureManager.delete(sub.name);
                    sub.structure = createFunc(sub.name, min.add(sub.start), min.add(sub.end));
                    buffer.structures[key] = sub.structure;
                } catch {
                    error = true;
                    break;
                }
            }
            if (error) {
                Object.values(buffer.structures).forEach((struct) => world.structureManager.delete(struct));
                return;
            } else {
                return buffer;
            }
        } else {
            const buffer = new RegionBuffer(name, false);
            yield* Jobs.loadArea(start, end);
            try {
                world.structureManager.delete(buffer.id);
                buffer.structure = createFunc(buffer.id, start, end);
                return buffer;
            } catch {
                return;
            }
        }
    }

    private static beyondMaxSize(size: Vector3) {
        return size.x > RegionBuffer.MAX_SIZE.x || size.y > RegionBuffer.MAX_SIZE.y || size.z > RegionBuffer.MAX_SIZE.z;
    }

    private static getSubStructs(name: string, size: Vector) {
        const subStructs: Record<string, SubStructure> = {};
        for (let z = 0; z < size.z; z += this.MAX_SIZE.z)
            for (let y = 0; y < size.y; y += this.MAX_SIZE.y)
                for (let x = 0; x < size.x; x += this.MAX_SIZE.x) {
                    const subStart = new Vector(x, y, z);
                    const subEnd = Vector.min(subStart.add(this.MAX_SIZE).sub(1), size.sub(1));
                    const locString = `${x / this.MAX_SIZE.x}_${y / this.MAX_SIZE.y}_${z / this.MAX_SIZE.z}`;

                    subStructs[locString] = {
                        structure: world.structureManager.get(name + "_" + locString),
                        name: name + "_" + locString,
                        start: subStart,
                        end: subEnd,
                    };
                }
        return subStructs;
    }
}

class RegionBlockImpl implements RegionBlock {
    private static AIR = "minecraft:air";
    private static LIQUIDS = ["minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"];

    readonly buffer: RegionBuffer;
    readonly x: number;
    readonly y: number;
    readonly z: number;

    private readonly bufferStructure: Structure;
    private readonly bufferStructureLocation: Vector3;
    private readonly bufferBlockNBT: Record<string, Structure>;

    constructor(buffer: RegionBuffer, extraBlockData: Record<string, Structure>, location: Vector3, structure: Structure, inStructureLocation: Vector3) {
        this.buffer = buffer;
        this.x = Math.floor(location.x);
        this.y = Math.floor(location.y);
        this.z = Math.floor(location.z);
        this.bufferBlockNBT = extraBlockData;
        this.bufferStructure = structure;
        this.bufferStructureLocation = inStructureLocation;
    }

    get permutation(): BlockPermutation | undefined {
        return this.bufferStructure.getBlockPermutation(this.bufferStructureLocation);
    }
    get location(): Vector3 {
        return { x: this.x, y: this.y, z: this.z };
    }
    get nbtStructure(): Structure | undefined {
        return this.bufferBlockNBT[locToString(this.location)];
    }
    get type(): BlockType {
        return this.permutation.type;
    }
    get typeId(): string {
        return this.permutation.type.id;
    }

    get isAir(): boolean {
        return this.permutation.matches(RegionBlockImpl.AIR);
    }
    get isLiquid(): boolean {
        return RegionBlockImpl.LIQUIDS.includes(this.permutation.type.id);
    }
    get isWaterlogged(): boolean {
        return this.bufferStructure.getIsWaterlogged(this.bufferStructureLocation);
    }

    above(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x, y: this.y + (steps ?? 1), z: this.z });
    }
    below(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x, y: this.y - (steps ?? 1), z: this.z });
    }
    north(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x, y: this.y, z: this.z - (steps ?? 1) });
    }
    south(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x, y: this.y, z: this.z + (steps ?? 1) });
    }
    east(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x + (steps ?? 1), y: this.y, z: this.z });
    }
    west(steps?: number): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x - (steps ?? 1), y: this.y, z: this.z });
    }
    offset(offset: Vector3): RegionBlock | undefined {
        return this.buffer.getBlock({ x: this.x + offset.x, y: this.y + offset.y, z: this.z + offset.z });
    }

    bottomCenter(): Vector3 {
        return { x: this.x + 0.5, y: this.y, z: this.z + 0.5 };
    }
    center(): Vector3 {
        return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 };
    }

    getTags(): string[] {
        return this.permutation.getTags();
    }
    hasTag(tag: string): boolean {
        return this.permutation.hasTag(tag);
    }

    matches(blockName: string, states?: Record<string, boolean | number | string>): boolean {
        return this.permutation.matches(blockName, states);
    }
    setPermutation(permutation: BlockPermutation): void {
        let key: string;
        if (permutation?.type.id !== this.permutation?.type.id && (key = locToString(this.location)) in this.bufferBlockNBT) {
            world.structureManager.delete(this.bufferBlockNBT[key]);
            delete this.bufferBlockNBT[key];
        }
        this.bufferStructure.setBlockPermutation(this.bufferStructureLocation, permutation);
    }
    setType(blockType: BlockType | string): void {
        this.setPermutation(BlockPermutation.resolve(typeof blockType === "string" ? blockType : blockType.id));
    }
}

function blockRecordable(block: Block) {
    return blockHasNBTData(block) || /* Until Mojang fixes trapdoor rotation... */ block.typeId.match(/^minecraft:.*trapdoor$/);
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
