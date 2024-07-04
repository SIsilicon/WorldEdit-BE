import { Server, Vector, regionIterateBlocks } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Selection } from "@modules/selection.js";
import { BlockPermutation } from "@minecraft/server";
import { directionVectors } from "@modules/directions.js";
import { getWorldHeightLimits } from "server/util.js";
import { BlockChanges } from "@modules/history.js";

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
    DEFAULT,
    LIFT,
    FILL,
    MELT,
    SMOOTH,
}

const fluids = {
    "minecraft:air": BlockPermutation.resolve("air"),
    "minecraft:water": BlockPermutation.resolve("water"),
    "minecraft:lava": BlockPermutation.resolve("lava"),
};

/**
 * Shapes terrain in various ways
 */
export class ErosionBrush extends Brush {
    public readonly id = "erosion_brush";

    private radius: number;
    private preset: ErosionPreset;

    private type: ErosionType;

    /**
     * @param radius The radius of the spheres
     * @param type The type of erosion brush
     */
    constructor(radius: number, type: ErosionType) {
        super();
        this.assertSizeInRange(radius);
        this.radius = radius;
        this.preset = erosionTypes.get(type);
        this.type = type;
    }

    public resize(value: number) {
        this.assertSizeInRange(value);
        this.radius = value;
    }

    public getSize(): number {
        return this.radius;
    }

    public getType(): ErosionType {
        return this.type;
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
        const blockChanges = history.collectBlockChanges(record);
        try {
            for (let i = 0; i < this.preset.erodeIterations; i++) {
                yield* this.processErosion(range, this.preset.erodeThreshold, blockChanges, activeMask);
            }
            for (let i = 0; i < this.preset.fillIterations; i++) {
                yield* this.processFill(range, this.preset.fillThreshold, blockChanges, activeMask);
            }

            yield* blockChanges.flush();
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

    private *processErosion(range: [Vector, Vector], threshold: number, blockChanges: BlockChanges, mask?: Mask) {
        const centre = Vector.add(...range).mul(0.5);
        const r2 = (this.radius + 0.5) * (this.radius + 0.5);
        const isAirOrFluid = Server.block.isAirOrFluid;

        for (const loc of regionIterateBlocks(...range)) {
            if (centre.sub(loc).lengthSqr > r2 || isAirOrFluid(blockChanges.getBlockPerm(loc)) || (mask && !mask.matchesBlock(blockChanges.dimension.getBlock(loc)))) {
                continue;
            }

            let count = 0;
            const fluidTypes: [string, number][] = [];
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [_, dir] of directionVectors) {
                const block = blockChanges.getBlockPerm(Vector.add(loc, dir));
                if (isAirOrFluid(block)) {
                    count++;
                    let foundType = false;
                    for (let i = 0; i < fluidTypes.length; i++) {
                        if (fluidTypes[i][0] == block.type.id) {
                            fluidTypes[i][1]++;
                            foundType = true;
                            break;
                        }
                    }
                    if (!foundType) {
                        fluidTypes.push([block.type.id, 1]);
                    }
                }
            }

            if (count >= threshold) {
                let maxCount = 0;
                let maxBlock: string;
                for (const [block, times] of fluidTypes) {
                    if (times > maxCount) {
                        maxCount = times;
                        maxBlock = block;
                    }
                }
                blockChanges.setBlock(loc, fluids[maxBlock as keyof typeof fluids]);
            }
            yield 0;
        }
        blockChanges.applyIteration();
    }

    private *processFill(range: [Vector, Vector], threshold: number, blockChanges: BlockChanges, mask?: Mask) {
        const centre = Vector.add(...range).mul(0.5);
        const r2 = (this.radius + 0.5) * (this.radius + 0.5);
        const isAirOrFluid = Server.block.isAirOrFluid;

        for (const loc of regionIterateBlocks(...range)) {
            if (centre.sub(loc).lengthSqr > r2 || !isAirOrFluid(blockChanges.getBlockPerm(loc))) {
                continue;
            }

            let count = 0;
            const blockTypes: [BlockPermutation, number][] = [];
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [_, dir] of directionVectors) {
                const block = blockChanges.getBlockPerm(Vector.add(loc, dir));
                if (!isAirOrFluid(block) && (!mask || mask.matchesBlock(blockChanges.dimension.getBlock(Vector.add(loc, dir))))) {
                    count++;
                    let foundType = false;
                    for (let i = 0; i < blockTypes.length; i++) {
                        if (blockTypes[i][0].matches(block.type.id, block.getAllStates())) {
                            blockTypes[i][1]++;
                            foundType = true;
                            break;
                        }
                    }
                    if (!foundType) blockTypes.push([block, 1]);
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
                blockChanges.setBlock(loc, maxBlock);
            }
            yield 0;
        }
        blockChanges.applyIteration();
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            type: this.type,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.type];
    }
}
brushTypes.set("erosion_brush", ErosionBrush);

const erosionTypes = new Map<ErosionType, ErosionPreset>([
    [ErosionType.DEFAULT, new ErosionPreset(1, 1, 6, 0)],
    [ErosionType.LIFT, new ErosionPreset(6, 0, 1, 1)],
    [ErosionType.FILL, new ErosionPreset(5, 1, 2, 1)],
    [ErosionType.MELT, new ErosionPreset(2, 1, 5, 1)],
    [ErosionType.SMOOTH, new ErosionPreset(3, 1, 3, 1)],
]);
