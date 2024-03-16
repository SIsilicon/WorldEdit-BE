import { Block, Vector3 } from "@minecraft/server";
import { assertCanBuildWithin } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { iterateChunk, regionIterateBlocks, regionIterateChunks, regionVolume, sleep, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { getWorldHeightLimits, snap } from "../util.js";
import { JobFunction, Jobs } from "@modules/jobs.js";

enum ChunkStatus {
    EMPTY,
    FULL,
    DETAIL,
}

export type shapeGenOptions = {
    hollow?: boolean;
    wall?: boolean;
    recordHistory?: boolean;
    ignoreGlobalMask?: boolean;
};

export type shapeGenVars = {
    // isSolidCuboid?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
};

/**
 * A base shape class for generating blocks in a variety of formations.
 */
export abstract class Shape {
    /**
     * Whether the shape is being used in a brush.
     * Shapes used in a brush may handle history recording differently from other cases.
     */
    public usedInBrush = false;

    protected static readonly ChunkStatus = ChunkStatus;

    protected abstract customHollow: boolean;

    private genVars: shapeGenVars;

    /**
     * Get the bounds of the shape.
     * @param loc The location of the shape
     * @return An array containing the minimum and maximum corners of the shape bounds
     */
    public abstract getRegion(loc: Vector3): [Vector, Vector];

    /**
     * Get the minimum and maximum y in a column of the shape.
     * @param x the x coordinate of the column
     * @param z the z coordinate of the column
     * @return The minimum y and maximum y if the the coordinates are within the shape; otherwise null
     */
    public abstract getYRange(x: number, z: number): [number, number] | null;

    /**
     * Prepares some variables that the shape will use when generating blocks.
     * @param genVars An object to contain variables used during shape generation ({inShape})
     * @param options Options passed from {generate}
     */
    protected abstract prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions): void;

    /**
     * Tells the shape generator whether a block should generate a particular location.
     * @param relLoc a location relative to the shape's center
     * @param genVars an object containing variables created in {prepGeneration}
     * @return True if a block should be generated; false otherwise
     */
    protected abstract inShape(relLoc: Vector, genVars: shapeGenVars): boolean;

    /**
     * Generates a list of particles that when displayed, shows the shape.
     */
    public abstract getOutline(loc: Vector): [string, Vector][];

    /**
     * Deduces what kind of chunk is being processed.
     * @param relLocMin relative location of the chunks minimum block corner
     * @param relLocMax relative location of the chunks maximum block corner
     * @param genVars
     * @returns
     * - `ChunkStatus.FULL` will use fast fill operations when simple patterns and masks are used.
     * - `ChunkStatus.EMPTY` will get ignored.
     * - `ChunkStatus.DETAIL` will place blocks one at a time.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getChunkStatus(relLocMin: Vector, relLocMax: Vector, genVars: shapeGenVars) {
        return ChunkStatus.DETAIL;
    }

    /**
     * Returns blocks that are in the shape.
     */
    public *getBlocks(loc: Vector3, options?: shapeGenOptions): Generator<Vector3> {
        const range = this.getRegion(loc);
        this.genVars = {};
        this.prepGeneration(this.genVars, options);

        for (const block of regionIterateBlocks(...range)) {
            if (this.inShape(Vector.sub(block, loc).floor(), this.genVars)) {
                yield block;
            }
        }
    }

    private inShapeHollow(relLoc: Vector, genVars: shapeGenVars) {
        const block = this.inShape(relLoc, genVars);
        if (genVars.hollow && block) {
            let neighbourCount = 0;
            for (const offset of [
                [0, 1, 0],
                [0, -1, 0],
                [1, 0, 0],
                [-1, 0, 0],
                [0, 0, 1],
                [0, 0, -1],
            ] as [number, number, number][]) {
                neighbourCount += this.inShape(relLoc.add(offset), genVars) ? 1 : 0;
            }
            return neighbourCount == 6 ? false : block;
        } else {
            return block;
        }
    }

    protected drawShape(vertices: Vector[], edges: [number, number][]): [string, Vector][] {
        const edgePoints: Vector[] = [];
        for (const edge of edges) {
            const [a, b] = [vertices[edge[0]], vertices[edge[1]]];
            const resolution = Math.min(Math.floor(b.sub(a).length), 16);
            for (let i = 1; i < resolution; i++) {
                const t = i / resolution;
                edgePoints.push(a.lerp(b, t));
            }
        }
        return vertices.concat(edgePoints).map((v) => ["wedit:selection_draw", v]);
    }

    protected drawCircle(center: Vector, radius: number, axis: "x" | "y" | "z"): [string, Vector][] {
        const [rotate, vec]: [typeof Vector.prototype.rotateX, Vector] =
            axis === "x" ? [Vector.prototype.rotateX, new Vector(0, 1, 0)] : axis === "y" ? [Vector.prototype.rotateY, new Vector(1, 0, 0)] : [Vector.prototype.rotateZ, new Vector(0, 1, 0)];
        const resolution = snap(Math.min(radius * 2 * Math.PI, 36), 4);

        const points: [string, Vector][] = [];
        for (let i = 0; i < resolution; i++) {
            let point: Vector = rotate.call(vec, (i / resolution) * 360);
            point = point.mul(radius).add(center).add(0.5);
            points.push(["wedit:selection_draw", point]);
        }
        return points;
    }

    /**
     * Generates a block formation at a certain location.
     * @param loc The location the shape will be generated at
     * @param pattern The pattern that the shape will be made with
     * @param mask The mask to decide where the shape will generate blocks
     * @param session The session that's using this shape
     * @param options A group of options that can change how the shape is generated
     */
    public *generate(loc: Vector, pattern: Pattern, mask: Mask, session: PlayerSession, options?: shapeGenOptions): Generator<JobFunction | Promise<unknown>, number> {
        const [min, max] = this.getRegion(loc);
        const player = session.getPlayer();
        const dimension = player.dimension;

        const [minY, maxY] = getWorldHeightLimits(dimension);
        min.y = Math.max(minY, min.y);
        max.y = Math.min(maxY, max.y);
        const canGenerate = max.y >= min.y;
        pattern.setContext(session, [min, max]);

        if (!Jobs.inContext()) assertCanBuildWithin(player, min, max);
        let blocksAffected = 0;
        const blocksAndChunks: (Block | [Vector3, Vector3])[] = [];
        mask = mask ?? new Mask();

        const history = options?.recordHistory ?? true ? session.getHistory() : null;
        const record = history?.record(this.usedInBrush);
        try {
            let count = 0;
            if (canGenerate) {
                this.genVars = {};
                this.prepGeneration(this.genVars, options);

                // TODO: Localize
                let activeMask = mask;
                const globalMask = options?.ignoreGlobalMask ?? false ? new Mask() : session.globalMask;
                activeMask = !activeMask ? globalMask : globalMask ? mask.intersect(globalMask) : activeMask;
                const simple = pattern.isSimple() && (!mask || mask.isSimple());

                let progress = 0;
                const volume = regionVolume(min, max);
                const inShapeFunc = this.customHollow ? "inShape" : "inShapeHollow";
                yield Jobs.nextStep("Calculating shape...");
                // Collect blocks and areas that will be changed.
                for (const [chunkMin, chunkMax] of regionIterateChunks(min, max)) {
                    yield Jobs.setProgress(progress / volume);

                    const chunkStatus = this.getChunkStatus(Vector.sub(chunkMin, loc).floor(), Vector.sub(chunkMax, loc).floor(), this.genVars);
                    if (chunkStatus === ChunkStatus.FULL && simple) {
                        const volume = regionVolume(chunkMin, chunkMax);
                        progress += volume;
                        blocksAffected += volume;
                        const prev = blocksAndChunks[blocksAndChunks.length - 1];
                        if (
                            Array.isArray(prev) &&
                            regionVolume(...prev) + volume > 32768 &&
                            prev[1].y + 1 === chunkMin.y &&
                            prev[0].x === chunkMin.x &&
                            prev[1].x === chunkMax.x &&
                            prev[0].z === chunkMin.z &&
                            prev[1].z === chunkMax.z
                        ) {
                            // Merge chunks in the same column
                            prev[1].y = chunkMax.y;
                        } else {
                            blocksAndChunks.push([chunkMin, chunkMax]);
                        }
                    } else if (chunkStatus === ChunkStatus.EMPTY) {
                        const volume = regionVolume(chunkMin, chunkMax);
                        progress += volume;
                    } else {
                        for (const blockLoc of regionIterateBlocks(chunkMin, chunkMax)) {
                            yield Jobs.setProgress(progress / volume);
                            progress++;
                            if (this[inShapeFunc](Vector.sub(blockLoc, loc).floor(), this.genVars)) {
                                let block;
                                do {
                                    if (Jobs.inContext()) {
                                        block = Jobs.loadBlock(blockLoc);
                                        if (!block) yield sleep(1);
                                    } else {
                                        block = dimension.getBlock(blockLoc);
                                    }
                                } while (!block && Jobs.inContext());
                                if (!activeMask.empty() && !activeMask.matchesBlock(block)) continue;
                                blocksAndChunks.push(block);
                                blocksAffected++;
                            }
                            yield;
                        }
                    }
                }

                progress = 0;
                yield Jobs.nextStep("Generating blocks...");
                yield history?.addUndoStructure(record, min, max);
                for (let block of blocksAndChunks) {
                    if (block instanceof Block) {
                        if (!block.isValid() && Jobs.inContext()) {
                            const loc = block.location;
                            block = undefined;
                            do {
                                block = Jobs.loadBlock(loc);
                                if (!block) yield sleep(1);
                            } while (!block);
                        }

                        if (pattern.setBlock(block)) count++;
                        if (iterateChunk()) yield Jobs.setProgress(progress / blocksAffected);
                        progress++;
                    } else {
                        const [min, max] = block;
                        const volume = regionVolume(min, max);
                        if (Jobs.inContext()) while (!Jobs.loadBlock(min)) yield sleep(1);
                        if (pattern.fillSimpleArea(dimension, min, max, mask)) count += volume;
                        yield Jobs.setProgress(progress / blocksAffected);
                        progress += volume;
                    }
                }
                yield history?.addRedoStructure(record, min, max);
            }
            history?.commit(record);
            return count;
        } catch (e) {
            history?.cancel(record);
            throw e;
        }
    }
}
