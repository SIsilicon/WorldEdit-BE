import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Jobs } from "@modules/jobs.js";
import { getWorldHeightLimits } from "server/util.js";
import { SphereShape } from "server/shapes/sphere.js";
import { Shape } from "server/shapes/base_shape.js";
import { Direction, Vector3 } from "@minecraft/server";
import { closestPoint } from "library/utils/closestpoint.js";

const neighborChecks = Object.values(Direction).map((direction) => Vector.from(direction).toJSON());

interface Cell extends Vector3 {
    value: number;
}

class CellMap {
    private map = new Map<string, Cell>();

    set(cell: Vector3, value: number) {
        // Initialize cell's neighbours in the set if there are none
        for (const direction of neighborChecks) {
            const coord = { x: cell.x + direction.x, y: cell.y + direction.y, z: cell.z + direction.z };
            const key = this.hash(coord);
            if (!this.map.has(key)) this.map.set(key, { ...coord, value });
        }
        this.map.set(this.hash(cell), { ...cell, value });
    }

    get(cell: Vector3) {
        return this.map.get(this.hash(cell))?.value;
    }

    *[Symbol.iterator]() {
        for (const cell of this.map.values()) yield cell;
    }

    private hash(vector: Vector3) {
        return vector.x + " " + vector.y + " " + vector.z;
    }
}

/**
 * creates a blob of blocks
 */
export class BlobBrush extends Brush {
    public readonly id = "blob_brush";

    public growPercent: number;
    public smoothness: number;

    private _pattern: Pattern;
    private _radius: number;

    /**
     * @param radius The radius of the brush
     * @param pattern The type of block(s) to generate
     * @param growPercent The chance of a block in the blob to spread
     * @param smoothness The amount of smoothing the blob goes through after growing
     */
    constructor(radius: number, pattern: Pattern, growPercent = 50, smoothness = 0) {
        super();
        this.growPercent = growPercent;
        this.smoothness = smoothness;
        this.pattern = pattern;
        this.radius = radius;
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(value: number) {
        this.assertSizeInRange(value);
        this._radius = value;
    }

    public get pattern(): Pattern {
        return this._pattern;
    }

    public set pattern(value: Pattern) {
        this._pattern = value;
    }

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const dimension = session.player.dimension;
        let min = new Vector(Infinity, Infinity, Infinity);
        let max = new Vector(-Infinity, -Infinity, -Infinity);

        const brushSize = this.radius + 0.5;
        const smoothness = this.smoothness;
        const growPercent = this.growPercent / 100;
        let splat = new CellMap();
        let backSplat = new CellMap();

        for (const loc of locations) {
            splat.set(loc, 1.0);
            min = Vector.min(min, loc.sub(brushSize));
            max = Vector.max(max, loc.add(brushSize));
        }
        const [minY, maxY] = getWorldHeightLimits(dimension);
        min.y = Math.max(minY, min.y);
        max.y = Math.min(maxY, max.y);

        const closest = closestPoint(locations);
        const distanceFromStroke = (location: Vector3) => {
            const nearest = closest(location);
            return Vector.sub(location, nearest).length;
        };

        // Grow blob
        for (let r = 0; r < brushSize * Math.SQRT2; r++) {
            for (const cell of splat) {
                if (!cell.value) {
                    let neighbours = 0;
                    if (splat.get({ ...cell, x: cell.x - 1 })) neighbours++;
                    if (splat.get({ ...cell, y: cell.y - 1 })) neighbours++;
                    if (splat.get({ ...cell, z: cell.z - 1 })) neighbours++;
                    if (splat.get({ ...cell, x: cell.x + 1 })) neighbours++;
                    if (splat.get({ ...cell, y: cell.y + 1 })) neighbours++;
                    if (splat.get({ ...cell, z: cell.z + 1 })) neighbours++;
                    if (neighbours >= 1 && Math.random() <= growPercent) backSplat.set(cell, 1.0);
                } else {
                    backSplat.set(cell, cell.value);
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
            const { x, y, z } = { x: Number(axis === 0), y: Number(axis === 1), z: Number(axis === 2) };

            let yielding = 0;
            for (const cell of splat) {
                let density = cell.value * 1.4;
                density += (splat.get({ x: cell.x + x, y: cell.y + y, z: cell.z + z }) ?? 0) * 0.8;
                density += (splat.get({ x: cell.x - x, y: cell.y - y, z: cell.z - z }) ?? 0) * 0.8;
                backSplat.set(cell, density / 3);
                if (yielding++ > 100) {
                    yielding = 0;
                    yield;
                }
            }

            const temp = splat;
            splat = backSplat;
            backSplat = temp;
        }

        const pattern = this._pattern.withContext(session, [min, max], { gradientRadius: brushSize, strokePoints: locations });
        mask = mask?.withContext(session);

        const history = session.history;
        const record = history.record();
        try {
            yield* history.trackRegion(record, min, max);
            for (const cell of splat) {
                if (cell.y < min.y || cell.y > max.y) continue;
                if (cell.value > 0.5 && distanceFromStroke(cell) <= brushSize) {
                    const block = yield* Jobs.loadBlock(cell);
                    if (!mask || mask.matchesBlock(block)) pattern.setBlock(block);
                    yield;
                }
            }
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    }

    public getOutline(): [Shape, Vector] {
        return [new SphereShape(this.radius), Vector.ZERO];
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            pattern: this._pattern,
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
