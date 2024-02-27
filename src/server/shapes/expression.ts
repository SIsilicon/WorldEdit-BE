import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";
import { Expression } from "@modules/expression.js";

export class ExpressionShape extends Shape {
    private size: Vector;
    private expr: Expression;

    protected customHollow = false;

    constructor(size: Vector, expr: Expression) {
        super();
        this.size = size;
        this.expr = expr;
    }

    public getRegion(loc: Vector) {
        return <[Vector, Vector]>[loc, loc.offset(this.size.x - 1, this.size.y - 1, this.size.z - 1)];
    }

    public getYRange() {
        throw Error("YRange not implemented");
        return [null, null] as [number, number];
    }

    public getOutline(loc: Vector) {
        const min = loc;
        const max = loc.add(this.size);

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
        genVars.hollow = options.hollow;
        genVars.neighbourOffsets = [
            [0, 1, 0],
            [0, -1, 0],
            [1, 0, 0],
            [-1, 0, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];
        genVars.func = this.expr.compile();
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const getBlock = (offX: number, offY: number, offZ: number) => {
            const coords = [
                ((relLoc.x + offX) / Math.max(this.size.x - 1, 1)) * 2.0 - 1.0,
                ((relLoc.y + offY) / Math.max(this.size.y - 1, 1)) * 2.0 - 1.0,
                ((relLoc.z + offZ) / Math.max(this.size.z - 1, 1)) * 2.0 - 1.0,
            ];
            const val = genVars.func(coords[0], coords[1], coords[2]);
            return val == true || val > 0;
        };

        const block = getBlock(0, 0, 0);
        if (genVars.hollow && block) {
            let neighbourCount = 0;
            for (const offset of genVars.neighbourOffsets) {
                neighbourCount += getBlock(...(offset as [number, number, number])) ? 1 : 0;
            }
            return neighbourCount == 6 ? false : block;
        } else {
            return block;
        }
    }
}
