import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class CuboidShape extends Shape {
    private size: [number, number, number] = [0, 0, 0];

    protected customHollow = true;

    constructor(length: number, width: number, depth: number) {
        super();
        this.size = [length, width, depth];
    }

    public getRegion(loc: Vector) {
        return <[Vector, Vector]>[loc, loc.offset(this.size[0] - 1, this.size[1] - 1, this.size[2] - 1)];
    }

    public getYRange() {
        return <[number, number]>[0, this.size[1] - 1];
    }

    public getOutline() {
        const min = Vector.ZERO;
        const max = Vector.from(this.size);

        const vertices = [
            new Vector(min.x, min.y, min.z),
            new Vector(max.x, min.y, min.z),
            new Vector(min.x, max.y, min.z),
            new Vector(max.x, max.y, min.z),
            new Vector(min.x, min.y, max.z),
            new Vector(max.x, min.y, max.z),
            new Vector(min.x, max.y, max.z),
            new Vector(max.x, max.y, max.z),
        ];
        const edges: [number, number][] = [
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
            [0, 2],
            [1, 3],
            [4, 6],
            [5, 7],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ];
        return this.drawShape(vertices, edges);
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.isWall = options?.wall ?? false;
        genVars.hollowOffset = options?.hollowThickness ?? 0;
        genVars.end = this.size.map((v) => v - (genVars.isHollow || genVars.isWall ? options?.hollowThickness ?? 1 : 1));

        if (!genVars.isHollow && !genVars.isWall) {
            genVars.isSolidCuboid = true;
        }
    }

    protected getChunkStatus(relLocMin: Vector, relLocMax: Vector, genVars: shapeGenVars) {
        return genVars.isWall || genVars.isHollow ? Shape.ChunkStatus.DETAIL : Shape.ChunkStatus.FULL;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const end = genVars.end;
        const hollowOffset = genVars.hollowOffset;
        if (genVars.isWall && relLoc.x > hollowOffset && relLoc.x < end[0] && relLoc.z > hollowOffset && relLoc.z < end[2]) {
            return false;
        } else if (genVars.isHollow && relLoc.x > hollowOffset && relLoc.x < end[0] && relLoc.y > hollowOffset && relLoc.y < end[1] && relLoc.z > hollowOffset && relLoc.z < end[2]) {
            return false;
        }

        return true;
    }
}
