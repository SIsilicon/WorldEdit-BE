import { regionIterateBlocks, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Selection } from "@modules/selection.js";
import { Pattern } from "@modules/pattern.js";
import { Jobs } from "@modules/jobs.js";
import { getWorldHeightLimits } from "server/util.js";

/**
 * creates a blob of blocks
 */
export class BlobBrush extends Brush {
    public readonly id = "blob_brush";

    private growPercent: number;
    private smoothness: number;
    private pattern: Pattern;
    private radius: number;

    /**
     * @param radius The radius of the brush
     * @param pattern The type of block(s) to generate
     * @param growPercent The chance of a block in the blob to spread
     * @param smoothness The amount of smoothing the blob goes through after growing
     */
    constructor(radius: number, pattern: Pattern, growPercent = 10, smoothness = 0) {
        super();
        this.assertSizeInRange(radius);
        this.growPercent = growPercent;
        this.smoothness = smoothness;
        this.pattern = pattern;
        this.radius = radius;
    }

    public resize(value: number) {
        this.assertSizeInRange(value);
        this.radius = value;
    }

    public getSize(): number {
        return this.radius;
    }

    public paintWith(value: Pattern) {
        this.pattern = value;
    }

    public getPattern(): Pattern {
        return this.pattern;
    }

    public *apply(hit: Vector, session: PlayerSession, mask?: Mask) {
        const dimension = session.getPlayer().dimension;
        const [min, max] = [hit.sub(this.radius), hit.add(this.radius)];
        const pattern = this.pattern.withContext(session, [min, max]);
        mask = mask?.withContext(session);

        const [minY, maxY] = getWorldHeightLimits(dimension);
        min.y = Math.max(minY, min.y);
        max.y = Math.min(maxY, max.y);

        const brushSize = this.radius;
        const smoothness = this.smoothness;
        const brushSizeDoubled = 2 * brushSize;
        const growPercent = this.growPercent / 100;
        let splat = Array.from({ length: brushSizeDoubled + 1 }, () => Array.from({ length: brushSizeDoubled + 1 }, () => Array(brushSizeDoubled + 1).fill(0)));
        let backSplat = Array.from({ length: brushSizeDoubled + 1 }, () => Array.from({ length: brushSizeDoubled + 1 }, () => Array(brushSizeDoubled + 1).fill(0)));
        splat[brushSize][brushSize][brushSize] = 1;

        yield* Jobs.run(session, 1, function* () {
            // Grow blob
            for (let r = 0; r < brushSize * Math.SQRT2; r++) {
                for (const { x, y, z } of regionIterateBlocks(Vector.ZERO, Vector.ONE.mul(brushSizeDoubled))) {
                    backSplat[x][y][z] = splat[x][y][z];
                    let growCheck = 0;
                    if (splat[x][y][z] === 0) {
                        if (x !== 0 && splat[x - 1][y][z] === 1) growCheck++;
                        if (y !== 0 && splat[x][y - 1][z] === 1) growCheck++;
                        if (z !== 0 && splat[x][y][z - 1] === 1) growCheck++;
                        if (x !== brushSizeDoubled && splat[x + 1][y][z] === 1) growCheck++;
                        if (y !== brushSizeDoubled && splat[x][y + 1][z] === 1) growCheck++;
                        if (z !== brushSizeDoubled && splat[x][y][z + 1] === 1) growCheck++;
                    }
                    if (growCheck >= 1 && Math.random() <= growPercent) backSplat[x][y][z] = 1;
                }

                const temp = splat;
                splat = backSplat;
                backSplat = temp;
                yield;
            }
            // Smooth blob
            for (let s = 0; s < smoothness; s++) {
                for (const loc of regionIterateBlocks(Vector.ZERO, Vector.ONE.mul(brushSizeDoubled))) {
                    let newGrow = 0;
                    const { x, y, z } = loc;
                    for (const { x, y, z } of regionIterateBlocks(Vector.sub(loc, 1), Vector.add(loc, 1))) newGrow += splat[x]?.[y]?.[z] ?? 0;
                    backSplat[x][y][z] = (0.5 * newGrow) / 27 + 0.5 * splat[x][y][z];
                }
                const temp = splat;
                splat = backSplat;
                backSplat = temp;
                yield;
            }

            const rSquared = Math.pow(brushSize + 1, 2);

            const history = session.getHistory();
            const record = history.record();
            try {
                yield* history.addUndoStructure(record, min, max);
                for (let x = brushSizeDoubled; x >= 0; x--) {
                    const xSquared = Math.pow(x - brushSize - 1, 2);
                    for (let y = brushSizeDoubled; y >= 0; y--) {
                        const height = hit.y - brushSize + y;
                        if (height < min.y || height > max.y) continue;

                        const ySquared = Math.pow(y - brushSize - 1, 2);
                        for (let z = brushSizeDoubled; z >= 0; z--) {
                            if (splat[x][y][z] > 0.5 && xSquared + ySquared + Math.pow(z - brushSize - 1, 2) <= rSquared) {
                                const loc = new Vector(hit.x - brushSize + x, height, hit.z - brushSize + z);
                                const block = dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc));
                                if (!mask || mask.matchesBlock(block)) pattern.setBlock(block);
                                yield;
                            }
                        }
                    }
                }
                yield* history.addRedoStructure(record, min, max);
                history.commit(record);
            } catch (e) {
                history.cancel(record);
                throw e;
            }
        });
    }

    public updateOutline(selection: Selection, loc: Vector): void {
        selection.mode = "sphere";
        selection.set(0, loc);
        selection.set(1, loc.offset(0, 0, this.radius));
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            pattern: this.pattern,
            growPercent: this.growPercent,
            smoothness: this.smoothness,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, new Pattern(json.pattern), json.growPercent];
    }
}
brushTypes.set("blob_brush", BlobBrush);
