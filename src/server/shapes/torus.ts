import { MolangVariableMap, Player } from "@minecraft/server";
import { Vector, axis } from "@notbeer-api";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape";

export class TorusShape extends Shape {
    private innerRadius: number;
    private outerRadius: number;
    private axes: [axis, axis, axis];

    protected customHollow = true;

    constructor(outerRadius: number, innerRadius: number, direction?: Vector) {
        super();
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;

        if ((direction?.x ?? 0) !== 0) {
            this.axes = ["y", "x", "z"];
        } else if ((direction?.z ?? 0) !== 0) {
            this.axes = ["x", "z", "y"];
        } else {
            this.axes = ["x", "y", "z"];
        }
    }

    public getRegion(loc: Vector) {
        const min = new Vector(-this.outerRadius - this.innerRadius, -this.innerRadius, -this.outerRadius - this.innerRadius);
        const max = new Vector(this.outerRadius + this.innerRadius, this.innerRadius, this.outerRadius + this.innerRadius);
        return <[Vector, Vector]>[loc.offset(min[this.axes[0]], min[this.axes[1]], min[this.axes[2]]), loc.offset(max[this.axes[0]], max[this.axes[1]], max[this.axes[2]])];
    }

    public getYRange() {
        throw Error("YRange not implemented");
    }

    public getOutline(loc: Vector) {
        loc = loc.ceil();
        const maxRadius = this.outerRadius + 0.5;
        return this.drawCircle(loc.sub([0, 0.5, 0]), maxRadius, "y");
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.innerRadOff = this.innerRadius + 0.5;
        genVars.outerRadOff = this.outerRadius;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        relLoc = new Vector(Math.hypot(relLoc[this.axes[0]], relLoc[this.axes[2]]) - genVars.outerRadOff, relLoc[this.axes[1]], 0);

        if (genVars.isHollow) {
            const hLocal = [relLoc.x / (genVars.innerRadOff - 1.0), relLoc.y / (genVars.innerRadOff - 1.0)];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] < 1.0) return false;
        }

        const local = [relLoc.x / genVars.innerRadOff, relLoc.y / genVars.innerRadOff];
        if (local[0] * local[0] + local[1] * local[1] <= 1.0) return true;

        return false;
    }
}
