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
        genVars.isEdges = options?.edges ?? false;
        genVars.hollowOffset = options?.hollowThickness ?? 0;
        genVars.end = this.size.map((v) => v - (genVars.isHollow || genVars.isWall ? (options?.hollowThickness ?? 1) : 1));

        if (!genVars.isHollow && !genVars.isWall && !genVars.isEdges) {
            genVars.isSolidCuboid = true;
        }
    }

    protected getChunkStatus(relLocMin: Vector, relLocMax: Vector, genVars: shapeGenVars) {
        if (!genVars.isWall && !genVars.isHollow && !genVars.isEdges) {
            return Shape.ChunkStatus.FULL;
        }

        const end = genVars.end;
        const hollowOffset = genVars.hollowOffset;

        if (genVars.isEdges) {
            const touchesX = (relLocMin.x <= 0 && relLocMax.x >= 0) || (relLocMin.x <= end[0] && relLocMax.x >= end[0]);

            const touchesY = (relLocMin.y <= 0 && relLocMax.y >= 0) || (relLocMin.y <= end[1] && relLocMax.y >= end[1]);

            const touchesZ = (relLocMin.z <= 0 && relLocMax.z >= 0) || (relLocMin.z <= end[2] && relLocMax.z >= end[2]);

            const touchedAxes = Number(touchesX) + Number(touchesY) + Number(touchesZ);

            return touchedAxes >= 2 ? Shape.ChunkStatus.DETAIL : Shape.ChunkStatus.EMPTY;
        }

        const overlapsInterior = (min: number, max: number, axisEnd: number) => max > hollowOffset && min < axisEnd;

        const fullyInsideInterior = (min: number, max: number, axisEnd: number) => min > hollowOffset && max < axisEnd;

        const axes = genVars.isWall
            ? [
                  [relLocMin.x, relLocMax.x, end[0]],
                  [relLocMin.z, relLocMax.z, end[2]],
              ]
            : [
                  [relLocMin.x, relLocMax.x, end[0]],
                  [relLocMin.y, relLocMax.y, end[1]],
                  [relLocMin.z, relLocMax.z, end[2]],
              ];

        if (axes.every(([min, max, axisEnd]) => fullyInsideInterior(min, max, axisEnd))) {
            return Shape.ChunkStatus.EMPTY;
        }

        if (axes.some(([min, max, axisEnd]) => !overlapsInterior(min, max, axisEnd))) {
            return Shape.ChunkStatus.FULL;
        }

        return Shape.ChunkStatus.DETAIL;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const end = genVars.end;
        const hollowOffset = genVars.hollowOffset;

        if (genVars.isEdges) {
            let boundaries = 0;

            if (relLoc.x == 0 || relLoc.x == end[0]) boundaries++;
            if (relLoc.y == 0 || relLoc.y == end[1]) boundaries++;
            if (relLoc.z == 0 || relLoc.z == end[2]) boundaries++;

            return boundaries >= 2;
        }

        if (genVars.isWall && relLoc.x > hollowOffset && relLoc.x < end[0] && relLoc.z > hollowOffset && relLoc.z < end[2]) {
            return false;
        } else if (genVars.isHollow && relLoc.x > hollowOffset && relLoc.x < end[0] && relLoc.y > hollowOffset && relLoc.y < end[1] && relLoc.z > hollowOffset && relLoc.z < end[2]) {
            return false;
        }
        return true;
    }
}
