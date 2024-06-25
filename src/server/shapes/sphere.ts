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

    public getOutline(loc: Vector) {
        // TODO: Support oblique spheres
        const maxRadius = Math.max(...this.radii) + 0.5;
        return [...this.drawCircle(loc, maxRadius, "x"), ...this.drawCircle(loc, maxRadius, "y"), ...this.drawCircle(loc, maxRadius, "z")];
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map((v) => v + 0.5);
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow) {
            const hLocal = [relLoc.x / (genVars.radiiOff[0] - 1.0), relLoc.y / (genVars.radiiOff[1] - 1.0), relLoc.z / (genVars.radiiOff[2] - 1.0)];
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
