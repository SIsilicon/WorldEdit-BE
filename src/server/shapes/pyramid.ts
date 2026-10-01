import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class PyramidShape extends Shape {
    private size: number;
    private direction: Vector;

    protected customHollow = true;

    constructor(size: number, direction?: Vector) {
        super();
        this.size = size;
        this.direction = direction ?? new Vector(0, 1, 0);
    }

    public getRegion(loc: Vector) {
        const extent = this.size - 1;
        const min = new Vector(-extent, -extent, -extent);
        const max = new Vector(extent, extent, extent);

        if (this.direction.x > 0) min.x = 0;
        else if (this.direction.x < 0) max.x = 0;
        else if (this.direction.y > 0) min.y = 0;
        else if (this.direction.y < 0) max.y = 0;
        else if (this.direction.z > 0) min.z = 0;
        else if (this.direction.z < 0) max.z = 0;

        return <[Vector, Vector]>[loc.offset(min.x, min.y, min.z), loc.offset(max.x, max.y, max.z)];
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
    }

    public getOutline() {
        const vertices = [
            new Vector(-this.size + 1, 0, -this.size + 1),
            new Vector(-this.size + 1, 0, this.size),
            new Vector(this.size, 0, -this.size + 1),
            new Vector(this.size, 0, this.size),
            new Vector(0.5, this.size, 0.5),
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
        genVars.thickness = options?.hollowThickness ?? 1;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        let height: number;
        let local: [number, number];

        if (this.direction.x !== 0) {
            height = relLoc.x * this.direction.x;
            local = [relLoc.y, relLoc.z];
        } else if (this.direction.y !== 0) {
            height = relLoc.y * this.direction.y;
            local = [relLoc.x, relLoc.z];
        } else {
            height = relLoc.z * this.direction.z;
            local = [relLoc.x, relLoc.y];
        }

        const latSize = this.size - height - 0.5;

        if (genVars.isHollow) {
            const hLatSize = latSize - genVars.thickness;
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
