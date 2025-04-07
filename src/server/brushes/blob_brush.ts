import { regionIterateBlocks, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Jobs } from "@modules/jobs.js";
import { getWorldHeightLimits } from "server/util.js";
import { SphereShape } from "server/shapes/sphere.js";
import { Shape } from "server/shapes/base_shape.js";

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
    constructor(radius: number, pattern: Pattern, growPercent = 50, smoothness = 0) {
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
        const dimension = session.player.dimension;
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
                    if (splat[x][y][z] === 0) {
                        let neighbours = 0;
                        if (splat[x - 1]?.[y][z] === 1) neighbours++;
                        if (splat[x][y - 1]?.[z] === 1) neighbours++;
                        if (splat[x][y][z - 1] === 1) neighbours++;
                        if (splat[x + 1]?.[y][z] === 1) neighbours++;
                        if (splat[x][y + 1]?.[z] === 1) neighbours++;
                        if (splat[x][y][z + 1] === 1) neighbours++;
                        backSplat[x][y][z] = Number(neighbours >= 1 && Math.random() <= growPercent);
                    } else {
                        backSplat[x][y][z] = 1;
                    }
                }

                const temp = splat;
                splat = backSplat;
                backSplat = temp;
                yield;
            }
            // Smooth blob
            for (let s = 0; s < smoothness * 3; s++) {
                const axis = s % 3;
                const offsetX = Number(axis === 0);
                const offsetY = Number(axis === 1);
                const offsetZ = Number(axis === 2);

                for (const { x, y, z } of regionIterateBlocks(Vector.ZERO, Vector.ONE.mul(brushSizeDoubled))) {
                    let density = splat[x][y][z] * 1.4;
                    density += (splat[x + offsetX]?.[y + offsetY]?.[z + offsetZ] ?? 0) * 0.8;
                    density += (splat[x - offsetX]?.[y - offsetY]?.[z - offsetZ] ?? 0) * 0.8;
                    backSplat[x][y][z] = density / 3;
                }

                const temp = splat;
                splat = backSplat;
                backSplat = temp;
                yield;
            }

            const rSquared = Math.pow(brushSize + 1, 2);

            const history = session.history;
            const record = history.record();
            try {
                yield* history.trackRegion(record, min, max);
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
                yield* history.commit(record);
            } catch (e) {
                history.cancel(record);
                throw e;
            }
        });
    }

    public getOutline(): [Shape, Vector] {
        return [new SphereShape(this.radius), Vector.ZERO];
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
        return [json.radius, new Pattern(json.pattern), json.growPercent, json.smoothness];
    }
}
brushTypes.set("blob_brush", BlobBrush);
