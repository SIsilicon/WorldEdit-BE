import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class PyramidShape extends Shape {
    private size: number;

    protected customHollow = true;

    constructor(size: number) {
        super();
        this.size = size;
    }

    public getRegion(loc: Vector) {
        return <[Vector, Vector]>[loc.offset(-this.size + 1, 0, -this.size + 1), loc.offset(this.size - 1, this.size - 1, this.size - 1)];
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
        return null;
    }

    public getOutline(loc: Vector) {
        const vertices = [
            loc.add([-this.size + 1, 0, -this.size + 1]),
            loc.add([-this.size + 1, 0, this.size]),
            loc.add([this.size, 0, -this.size + 1]),
            loc.add([this.size, 0, this.size]),
            loc.add([0.5, this.size, 0.5]),
        ];
        const edges: [number, number][] = [
            [0, 1],
            [1, 3],
            [2, 0],
            [3, 2],
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
        ];
        return this.drawShape(vertices, edges);
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const latSize = this.size - relLoc.y - 0.5;
        const local = [relLoc.x, relLoc.z];

        if (genVars.isHollow) {
            const hLatSize = latSize - 1;
            if (local[0] > -hLatSize && local[0] < hLatSize && local[1] > -hLatSize && local[1] < hLatSize) {
                return false;
            }
        }

        if (local[0] > -latSize && local[0] < latSize && local[1] > -latSize && local[1] < latSize) {
            return true;
        }

        return false;
    }
}
