import { Vector3 } from "@minecraft/server";
import { regionBounds, Vector } from "@notbeer-api";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";

export class PolygonShape extends Shape {
    protected customHollow = true;

    private readonly points: Vector[];
    private readonly min: Vector;
    private readonly max: Vector;
    private readonly columns: number;

    public readonly isValid: boolean;

    constructor(points: Vector3[]) {
        super();

        this.points = points.map((point) => Vector.from(point));
        [this.min, this.max] = regionBounds(this.points);

        let areaTwice = 0;
        let boundary = 0;

        for (let i = 0; i < this.points.length; i++) {
            const a = this.points[i];
            const b = this.points[(i + 1) % this.points.length];

            areaTwice += a.x * b.z - b.x * a.z;

            // Count lattice points along this polygon edge.
            let dx = Math.abs(b.x - a.x);
            let dz = Math.abs(b.z - a.z);

            while (dz !== 0) {
                const remainder = dx % dz;
                dx = dz;
                dz = remainder;
            }

            boundary += dx;
        }

        this.isValid = this.points.length >= 3;

        if (!this.isValid) {
            this.columns = 0;
        } else if (!this.hasSelfIntersection()) {
            // Pick's theorem works for simple polygons.
            this.columns = (Math.abs(areaTwice) + boundary) / 2 + 1;
        } else {
            // For intersecting polygons, count the actual selected columns.
            let columns = 0;

            for (let x = this.min.x; x <= this.max.x; x++) {
                for (let z = this.min.z; z <= this.max.z; z++) {
                    if (this.containsXZ(x, z)) {
                        columns++;
                    }
                }
            }

            this.columns = columns;
        }
    }

    public getBlockCount() {
        return this.columns * (this.max.y - this.min.y + 1);
    }

    public getRegion(loc: Vector3): [Vector, Vector] {
        return [Vector.from(loc).add(this.min), Vector.from(loc).add(this.max)];
    }

    public getYRange(x: number, z: number): [number, number] | void {
        if (!this.containsXZ(x, z)) return;
        return [this.min.y, this.max.y];
    }

    public getOutline() {
        const bottom = this.points.map((point) => new Vector(point.x, this.min.y, point.z).add(0.5));
        const particles = this.drawLine(bottom, true);

        if (this.min.y !== this.max.y) {
            const top = this.points.map((point) => new Vector(point.x, this.max.y, point.z).add(0.5));

            particles.push(...this.drawLine(top, true));

            for (let i = 0; i < bottom.length; i++) {
                particles.push(...this.drawLine([bottom[i], top[i]]));
            }
        }

        return particles;
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.isWall = options?.wall ?? false;
        genVars.thickness = Math.max(1, Math.floor(options?.hollowThickness ?? 1));
    }

    protected inShape(point: Vector, genVars: shapeGenVars) {
        if (point.y < this.min.y || point.y > this.max.y || !this.containsXZ(point.x, point.z)) {
            return false;
        }

        if (!genVars.isHollow && !genVars.isWall) {
            return true;
        }

        const thickness = genVars.thickness;

        const side =
            !this.containsXZ(point.x + thickness, point.z) ||
            !this.containsXZ(point.x - thickness, point.z) ||
            !this.containsXZ(point.x, point.z + thickness) ||
            !this.containsXZ(point.x, point.z - thickness);

        // ;walls should not generate a floor or ceiling.
        if (genVars.isWall) {
            return side;
        }

        // ;faces should include both horizontal caps.
        return side || point.y < this.min.y + thickness || point.y > this.max.y - thickness;
    }

    private hasSelfIntersection(): boolean {
        const cross = (a: Vector, b: Vector, c: Vector) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

        const onSegment = (a: Vector, p: Vector, b: Vector) => p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.z >= Math.min(a.z, b.z) && p.z <= Math.max(a.z, b.z);

        const intersects = (a: Vector, b: Vector, c: Vector, d: Vector) => {
            const abC = cross(a, b, c);
            const abD = cross(a, b, d);
            const cdA = cross(c, d, a);
            const cdB = cross(c, d, b);

            if (abC === 0 && onSegment(a, c, b)) return true;
            if (abD === 0 && onSegment(a, d, b)) return true;
            if (cdA === 0 && onSegment(c, a, d)) return true;
            if (cdB === 0 && onSegment(c, b, d)) return true;

            return abC > 0 !== abD > 0 && cdA > 0 !== cdB > 0;
        };

        const count = this.points.length;

        for (let i = 0; i < count; i++) {
            const a = this.points[i];
            const b = this.points[(i + 1) % count];

            if (a.x === b.x && a.z === b.z) return true;

            for (let j = i + 1; j < count; j++) {
                // Adjacent edges are supposed to share a vertex.
                if (j === i + 1 || (i === 0 && j === count - 1)) {
                    continue;
                }

                const c = this.points[j];
                const d = this.points[(j + 1) % count];

                if (intersects(a, b, c, d)) return true;
            }
        }

        return false;
    }

    private containsXZ(x: number, z: number) {
        let inside = false;

        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const a = this.points[j];
            const b = this.points[i];

            // Include blocks lying directly on a polygon edge.
            const cross = (x - a.x) * (b.z - a.z) - (z - a.z) * (b.x - a.x);

            if (cross === 0 && x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && z >= Math.min(a.z, b.z) && z <= Math.max(a.z, b.z)) {
                return true;
            }

            // Even-odd ray casting, supporting concave polygons.
            if (a.z > z !== b.z > z && x < a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z)) {
                inside = !inside;
            }
        }

        return inside;
    }
}
