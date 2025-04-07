import { Block, BlockVolume, BlockVolumeBase, ListBlockVolume, Player, Vector3 } from "@minecraft/server";
import { assertCanBuildWithin } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { regionIterateBlocks, regionIterateChunks, regionVolume, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { getWorldHeightLimits, snap } from "../util.js";
import { JobFunction, Jobs } from "@modules/jobs.js";

enum ChunkStatus {
    /** Empty part of the shape. */
    EMPTY,
    /** Completely filled part of the shape. */
    FULL,
    /** Partially filled part of the shape. */
    DETAIL,
}

export type shapeGenOptions = {
    hollow?: boolean;
    hollowThickness?: number;
    wall?: boolean;
    recordHistory?: boolean;
    ignoreGlobalMask?: boolean;
};

export type shapeGenVars = {
    // isSolidCuboid?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
};

// const shapeCache: Record<string, BlockVolumeBase[]> = {};

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

    protected shapeCacheKey: string;

    private outlineCache: [string, Vector][];

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
    public abstract getYRange(x: number, z: number): [number, number] | void;

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
    protected abstract getOutline(): [string, Vector][];

    /**
     * Deduces what kind of chunk is being processed.
     * @param relLocMin relative location of the chunks minimum block corner
     * @param relLocMax relative location of the chunks maximum block corner
     * @param genVars
     * @returns ChunkStatus
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected getChunkStatus(relLocMin: Vector, relLocMax: Vector, genVars: shapeGenVars) {
        return ChunkStatus.DETAIL;
    }

    public draw(player: Player, loc: Vector3) {
        try {
            for (const [id, pos] of (this.outlineCache = this.outlineCache ?? this.getOutline())) {
                try {
                    player.spawnParticle(id, pos.add(loc));
                } catch {
                    /* pass */
                }
            }
        } catch {
            /* pass */
        }
    }

    /**
     * Returns blocks that are in the shape.
     */
    public *getBlocks(loc: Vector3, options?: shapeGenOptions): Generator<Vector3> {
        const range = this.getRegion(loc);
        this.genVars = {};
        this.prepGeneration(this.genVars, options);

        for (const block of regionIterateBlocks(...range)) {
            if (this.inShape(Vector.sub(block, loc).floor(), this.genVars)) yield block;
        }
    }

    private inShapeHollow(relLoc: Vector, genVars: shapeGenVars) {
        const block = this.inShape(relLoc, genVars);
        if (genVars.hollow && block) {
            const thickness = genVars.hollowThickness ?? 1;
            let neighbourCount = 0;
            for (const offset of [
                [0, thickness, 0],
                [0, -thickness, 0],
                [thickness, 0, 0],
                [-thickness, 0, 0],
                [0, 0, thickness],
                [0, 0, -thickness],
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
        const vec = axis === "x" ? new Vector(0, 1, 0) : axis === "y" ? new Vector(1, 0, 0) : new Vector(0, 1, 0);
        const resolution = snap(Math.min(radius * 2 * Math.PI, 36), 4);

        const points: [string, Vector][] = [];
        for (let i = 0; i < resolution; i++) {
            let point: Vector = vec.rotate((i / resolution) * 360, axis);
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
    public *generate(loc: Vector, pattern: Pattern, mask: Mask | undefined, session: PlayerSession, options?: shapeGenOptions): Generator<JobFunction | Promise<unknown>, number> {
        const [min, max] = this.getRegion(loc);
        const player = session.player;
        const dimension = player.dimension;

        const [minY, maxY] = getWorldHeightLimits(dimension);
        min.y = Math.max(minY, min.y);
        max.y = Math.min(maxY, max.y);
        const canGenerate = max.y >= min.y;
        pattern = pattern.withContext(session, [min, max]);
        const simplePattern = pattern.isSimple();

        if (!Jobs.inContext()) assertCanBuildWithin(player, min, max);
        let blocksAffected = 0;
        const volumes: (Block[] | BlockVolumeBase)[] = [];

        const history = options?.recordHistory ?? true ? session.history : undefined;
        const record = history?.record();

        if (!canGenerate) {
            history?.commit(record);
            yield Jobs.nextStep("Calculating shape...");
            yield Jobs.nextStep("Generating blocks...");
            return 0;
        }

        try {
            let count = 0;
            this.genVars = {};
            this.prepGeneration(this.genVars, options);

            // TODO: Localize
            let activeMask = mask ?? new Mask();
            const globalMask = options?.ignoreGlobalMask ?? false ? new Mask() : session.globalMask;
            activeMask = (!activeMask ? globalMask : globalMask ? activeMask.intersect(globalMask) : activeMask)?.withContext(session);
            const simpleMask = activeMask.isSimple();

            let progress = 0;
            const volume = regionVolume(min, max);
            const inShapeFunc = this.customHollow ? "inShape" : "inShapeHollow";
            yield Jobs.nextStep("Calculating shape...");
            // Collect blocks and areas that will be changed.
            for (const [chunkMin, chunkMax] of regionIterateChunks(min, max)) {
                yield Jobs.setProgress(progress / volume);

                const chunkStatus = this.getChunkStatus(Vector.sub(chunkMin, loc).floor(), Vector.sub(chunkMax, loc).floor(), this.genVars);
                if (chunkStatus === ChunkStatus.FULL && simpleMask) {
                    const volume = regionVolume(chunkMin, chunkMax);
                    progress += volume;
                    blocksAffected += volume;
                    volumes.push(new BlockVolume(chunkMin, chunkMax));
                } else if (chunkStatus === ChunkStatus.EMPTY) {
                    const volume = regionVolume(chunkMin, chunkMax);
                    progress += volume;
                } else {
                    const blocks = [];
                    for (const blockLoc of regionIterateBlocks(chunkMin, chunkMax)) {
                        yield Jobs.setProgress(progress / volume);
                        progress++;
                        if (this[inShapeFunc](Vector.sub(blockLoc, loc).floor(), this.genVars)) {
                            const block = dimension.getBlock(blockLoc) ?? (yield* Jobs.loadBlock(blockLoc));
                            if (simpleMask || activeMask.matchesBlock(block)) {
                                blocks.push(block);
                                blocksAffected++;
                            }
                        }
                        yield;
                    }
                    if (blocks.length) volumes.push(simplePattern ? new ListBlockVolume(blocks) : blocks);
                }
            }

            progress = 0;
            yield Jobs.nextStep("Generating blocks...");
            if (history) yield* history.trackRegion(record, min, max);
            const maskInSimpleFill = simpleMask ? activeMask : undefined;
            for (const volume of volumes) {
                yield Jobs.setProgress(progress / blocksAffected);
                if (Array.isArray(volume)) {
                    for (let block of volume) {
                        if (!block.isValid && Jobs.inContext()) block = yield* Jobs.loadBlock(loc);
                        if ((!maskInSimpleFill || maskInSimpleFill.matchesBlock(block)) && pattern.setBlock(block)) count++;
                        progress++;
                    }
                } else {
                    if (Jobs.inContext()) yield* Jobs.loadArea(volume.getMin(), volume.getMax());
                    count += pattern.fillBlocks(dimension, volume, maskInSimpleFill);
                    progress += volume.getCapacity();
                }
            }

            if (history) yield* history.commit(record);
            return count;
        } catch (e) {
            history?.cancel(record);
            throw e;
        }
    }
}
