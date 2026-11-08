import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class SphereShape extends Shape {
    private radii: [number, number, number] = [0, 0, 0];
    private domeDirection?: Vector;

    protected customHollow = true;

    constructor(radiusX: number, radiusY?: number, radiusZ?: number, domeDirection?: Vector) {
        super();
        this.radii[0] = radiusX;
        this.radii[1] = radiusY ?? this.radii[0];
        this.radii[2] = radiusZ ?? this.radii[1];
        this.domeDirection = domeDirection;
    }

    public getRegion(loc: Vector) {
        if (this.domeDirection?.x === 1) {
            return <[Vector, Vector]>[loc.offset(0, -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.x === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(0, this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.y === 1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], 0, -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.y === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], 0, this.radii[2])];
        } else if (this.domeDirection?.z === 1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], 0), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.z === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], 0)];
        } else {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        }
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
    }

    public getOutline() {
        // TODO: Support oblique spheres
        const maxRadius = Math.max(...this.radii) + 0.5;
        return [...this.drawCircle(Vector.ZERO, maxRadius, "x"), ...this.drawCircle(Vector.ZERO, maxRadius, "y"), ...this.drawCircle(Vector.ZERO, maxRadius, "z")];
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map((v) => v + 0.5);
        genVars.thickness = options?.hollowThickness ?? 1;
    }

    protected getChunkStatus(relLocMin: Vector, relLocMax: Vector, genVars: shapeGenVars) {
        const radii: number[] = genVars.radiiOff;

        const closest = new Vector(
            relLocMin.x > 0 ? relLocMin.x : relLocMax.x < 0 ? relLocMax.x : 0,
            relLocMin.y > 0 ? relLocMin.y : relLocMax.y < 0 ? relLocMax.y : 0,
            relLocMin.z > 0 ? relLocMin.z : relLocMax.z < 0 ? relLocMax.z : 0
        );

        const furthest = new Vector(
            Math.max(Math.abs(relLocMin.x), Math.abs(relLocMax.x)),
            Math.max(Math.abs(relLocMin.y), Math.abs(relLocMax.y)),
            Math.max(Math.abs(relLocMin.z), Math.abs(relLocMax.z))
        );

        const distanceSq = (point: Vector, radius: number[]) => (point.x / radius[0]) ** 2 + (point.y / radius[1]) ** 2 + (point.z / radius[2]) ** 2;

        if (distanceSq(closest, radii) > 1) {
            return Shape.ChunkStatus.EMPTY;
        }

        const outerMax = distanceSq(furthest, radii);

        if (!genVars.isHollow) {
            return outerMax <= 1 ? Shape.ChunkStatus.FULL : Shape.ChunkStatus.DETAIL;
        }

        const innerRadii = radii.map((radius) => radius - genVars.thickness);

        if (innerRadii.some((radius) => radius <= 0)) {
            return Shape.ChunkStatus.DETAIL;
        }

        if (distanceSq(furthest, innerRadii) < 1) {
            return Shape.ChunkStatus.EMPTY;
        }

        if (outerMax <= 1 && distanceSq(closest, innerRadii) >= 1) {
            return Shape.ChunkStatus.FULL;
        }

        return Shape.ChunkStatus.DETAIL;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow) {
            const thickness = genVars.thickness;
            const hLocal = [relLoc.x / (genVars.radiiOff[0] - thickness), relLoc.y / (genVars.radiiOff[1] - thickness), relLoc.z / (genVars.radiiOff[2] - thickness)];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] + hLocal[2] * hLocal[2] < 1.0) {
                return false;
            }
        }

        const local = [relLoc.x / genVars.radiiOff[0], relLoc.y / genVars.radiiOff[1], relLoc.z / genVars.radiiOff[2]];
        if (local[0] * local[0] + local[1] * local[1] + local[2] * local[2] <= 1.0) {
            return true;
        }

        return false;
    }
}
