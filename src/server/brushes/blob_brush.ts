import { Vector, VectorSet } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Jobs } from "@modules/jobs.js";
import { getWorldHeightLimits } from "server/util.js";
import { SphereShape } from "server/shapes/sphere.js";
import { Shape } from "server/shapes/base_shape.js";
import { Vector3 } from "@minecraft/server";
import { buildKDTree } from "library/utils/kdtree.js";

class Cell implements Vector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;

    constructor(
        vector: Vector3,
        public value: number
    ) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;
    }
}

function addCellToVectorSet(set: VectorSet, cell: Cell) {
    // Initialize cell's neighbours in the set if there are none
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const coord = Vector.add(cell, [x, y, z]);
                if (!set.has(coord)) set.add(new Cell(coord, 0.0));
            }
        }
    }
    set.add(cell);
}

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

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const dimension = session.player.dimension;
        let min = new Vector(Infinity, Infinity, Infinity);
        let max = new Vector(-Infinity, -Infinity, -Infinity);

        const brushSize = this.radius + 0.5;
        const smoothness = this.smoothness;
        const growPercent = this.growPercent / 100;
        let splat = new VectorSet<Cell>();
        let backSplat = new VectorSet<Cell>();

        for (const loc of locations) {
            addCellToVectorSet(splat, new Cell(loc, 1.0));
            min = Vector.min(min, loc.sub(brushSize));
            max = Vector.max(max, loc.add(brushSize));
        }
        const [minY, maxY] = getWorldHeightLimits(dimension);
        min.y = Math.max(minY, min.y);
        max.y = Math.min(maxY, max.y);

        const kdRoot = buildKDTree(locations);
        const distanceFromStroke = (location: Vector3) => {
            const nearest = kdRoot.nearest(location);
            return Vector.sub(location, nearest).length;
        };

        yield* Jobs.run(
            session,
            1,
            function* () {
                // Grow blob
                for (let r = 0; r < brushSize * Math.SQRT2; r++) {
                    for (const cell of splat) {
                        if (!cell.value) {
                            let neighbours = 0;
                            if (splat.get({ ...cell, x: cell.x - 1 })?.value) neighbours++;
                            if (splat.get({ ...cell, y: cell.y - 1 })?.value) neighbours++;
                            if (splat.get({ ...cell, z: cell.z - 1 })?.value) neighbours++;
                            if (splat.get({ ...cell, x: cell.x + 1 })?.value) neighbours++;
                            if (splat.get({ ...cell, y: cell.y + 1 })?.value) neighbours++;
                            if (splat.get({ ...cell, z: cell.z + 1 })?.value) neighbours++;
                            if (neighbours >= 1 && Math.random() <= growPercent) addCellToVectorSet(backSplat, new Cell(cell, 1.0));
                        } else {
                            addCellToVectorSet(backSplat, cell);
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
                    const offset = new Vector(Number(axis === 0), Number(axis === 1), Number(axis === 2));

                    for (const cell of splat) {
                        let density = cell.value * 1.4;
                        density += (splat.get(Vector.add(cell, offset))?.value ?? 0) * 0.8;
                        density += (splat.get(Vector.sub(cell, offset))?.value ?? 0) * 0.8;
                        addCellToVectorSet(backSplat, new Cell(cell, density / 3));
                    }

                    const temp = splat;
                    splat = backSplat;
                    backSplat = temp;
                    yield;
                }

                const pattern = this.pattern.withContext(session, [min, max], { gradientRadius: brushSize, strokePoints: locations });
                mask = mask?.withContext(session);

                const history = session.history;
                const record = history.record();
                try {
                    yield* history.trackRegion(record, min, max);
                    for (const cell of splat) {
                        if (cell.y < min.y || cell.y > max.y) continue;
                        if (cell.value > 0.5 && distanceFromStroke(cell) <= brushSize) {
                            const block = dimension.getBlock(cell) ?? (yield* Jobs.loadBlock(cell));
                            if (!mask || mask.matchesBlock(block)) pattern.setBlock(block);
                            yield;
                        }
                    }
                    yield* history.commit(record);
                } catch (e) {
                    history.cancel(record);
                    throw e;
                }
            },
            this
        );
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
