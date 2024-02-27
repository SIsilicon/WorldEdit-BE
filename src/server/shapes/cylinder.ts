import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class CylinderShape extends Shape {
    private radii: [number, number] = [0, 0];
    private height: number;

    protected customHollow = true;

    constructor(height: number, radiusX: number, radiusZ?: number) {
        super();
        this.height = height;
        this.radii[0] = radiusX;
        this.radii[1] = radiusZ ?? this.radii[0];
    }

    public getRegion(loc: Vector) {
        loc = loc.offset(0, -this.height / 2, 0).ceil();
        return <[Vector, Vector]>[loc.offset(-this.radii[0], 0, -this.radii[1]), loc.offset(this.radii[0], this.height - 1, this.radii[1])];
    }

    public getYRange(x: number, z: number) {
        const [lX, lZ] = [x / (this.radii[0] + 0.5), z / (this.radii[1] + 0.5)];
        return lX * lX + lZ * lZ > 1.0 ? null : <[number, number]>[-this.height / 2, this.height - 1 - this.height / 2];
    }

    public getOutline(loc: Vector) {
        // TODO: Support oblique cylinders
        loc = loc.offset(0, -this.height / 2, 0).ceil();
        const locWithOffset = loc.offset(0.5, 0, 0.5);
        const maxRadius = Math.max(...this.radii) + 0.5;
        const vertices = [
            locWithOffset.add([-maxRadius, 0, 0]),
            locWithOffset.add([-maxRadius, this.height, 0]),
            locWithOffset.add([maxRadius, 0, 0]),
            locWithOffset.add([maxRadius, this.height, 0]),
            locWithOffset.add([0, 0, -maxRadius]),
            locWithOffset.add([0, this.height, -maxRadius]),
            locWithOffset.add([0, 0, maxRadius]),
            locWithOffset.add([0, this.height, maxRadius]),
        ];
        const edges: [number, number][] = [
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
        ];
        return [...this.drawCircle(loc.sub([0, 0.5, 0]), maxRadius, "y"), ...this.drawCircle(loc.sub([0, 0.5, 0]).add([0, this.height, 0]), maxRadius, "y"), ...this.drawShape(vertices, edges)];
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map((v) => v + 0.5);
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow) {
            const hLocal = [relLoc.x / (genVars.radiiOff[0] - 1.0), relLoc.z / (genVars.radiiOff[1] - 1.0)];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] < 1.0) {
                return false;
            }
        }

        const local = [relLoc.x / genVars.radiiOff[0], relLoc.z / genVars.radiiOff[1]];
        if (local[0] * local[0] + local[1] * local[1] <= 1.0) {
            return true;
        }

        return false;
    }
}
