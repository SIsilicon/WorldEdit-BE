import { Vector, axis } from "@notbeer-api";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";

export class CastShape extends Shape {
    private radius: number;
    private maxRadius: number;
    private height: number;
    private axes: [axis, axis, axis];

    protected customHollow = true;

    constructor(radius: number, maxRadius: number, height: number, direction?: Vector) {
        super();

        this.radius = radius;
        this.maxRadius = maxRadius;
        this.height = height;

        if ((direction?.x ?? 0) !== 0) {
            this.axes = ["y", "x", "z"];
        } else if ((direction?.z ?? 0) !== 0) {
            this.axes = ["x", "z", "y"];
        } else {
            this.axes = ["x", "y", "z"];
        }
    }

    public getRegion(loc: Vector) {
        const center = new Vector(0, -this.height / 2, 0).ceil();

        const min = center.offset(-this.maxRadius, 0, -this.maxRadius);
        const max = center.offset(this.maxRadius, this.height - 1, this.maxRadius);

        return <[Vector, Vector]>[loc.offset(min[this.axes[0]], min[this.axes[1]], min[this.axes[2]]), loc.offset(max[this.axes[0]], max[this.axes[1]], max[this.axes[2]])];
    }

    public getYRange(): void {
        return;
    }

    public getOutline() {
        const axis = this.axes[1];

        const start = Math.ceil(-this.height / 2);
        const end = start + this.height - 1;
        const middle = (start + end) / 2;

        const startLoc = new Vector(0, 0, 0);
        const middleLoc = new Vector(0, 0, 0);
        const endLoc = new Vector(0, 0, 0);

        startLoc[axis] = start;
        middleLoc[axis] = middle;
        endLoc[axis] = end;

        return [...this.drawCircle(startLoc, this.radius + 0.5, axis), ...this.drawCircle(middleLoc, this.maxRadius + 0.5, axis), ...this.drawCircle(endLoc, this.radius + 0.5, axis)];
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.thickness = options?.hollowThickness ?? 1;

        genVars.radius = this.radius + 0.5;
        genVars.maxRadius = this.maxRadius + 0.5;

        genVars.start = Math.ceil(-this.height / 2);
        genVars.end = genVars.start + this.height - 1;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const axial = relLoc[this.axes[1]];

        if (axial < genVars.start || axial > genVars.end) {
            return false;
        }

        let t: number;

        if (this.height <= 1) {
            t = 0;
        } else {
            const progress = (axial - genVars.start) / (genVars.end - genVars.start);

            t = progress * 2 - 1;
        }

        const radiusSquared = genVars.maxRadius * genVars.maxRadius - (genVars.maxRadius * genVars.maxRadius - genVars.radius * genVars.radius) * t * t;

        const currentRadius = Math.sqrt(radiusSquared);

        const first = relLoc[this.axes[0]];
        const second = relLoc[this.axes[2]];

        const distanceSquared = first * first + second * second;

        if (distanceSquared > currentRadius * currentRadius) {
            return false;
        }

        if (genVars.isHollow) {
            const innerEndRadius = Math.max(genVars.radius - genVars.thickness, 0);
            const innerMaxRadius = Math.max(genVars.maxRadius - genVars.thickness, 0);

            const innerRadiusSquared = innerMaxRadius * innerMaxRadius - (innerMaxRadius * innerMaxRadius - innerEndRadius * innerEndRadius) * t * t;

            if (innerRadiusSquared > 0 && distanceSquared < innerRadiusSquared) {
                return false;
            }
        }

        return true;
    }
}
