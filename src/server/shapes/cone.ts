import { Shape, shapeGenVars } from "./base_shape.js";
import { Vector, axis } from "@notbeer-api";

export class ConeShape extends Shape {
    private radius: number;
    private height: number;
    private axis: axis;
    private crossAxes: [axis, axis];
    private directionSign: number;

    protected customHollow = false;

    constructor(radius: number, height: number, direction?: Vector) {
        super();

        this.radius = radius;
        this.height = height;

        if ((direction?.x ?? 0) !== 0) {
            this.axis = "x";
            this.crossAxes = ["y", "z"];
            this.directionSign = Math.sign(direction.x);
        } else if ((direction?.z ?? 0) !== 0) {
            this.axis = "z";
            this.crossAxes = ["x", "y"];
            this.directionSign = Math.sign(direction.z);
        } else {
            this.axis = "y";
            this.crossAxes = ["x", "z"];
            this.directionSign = Math.sign(direction?.y ?? 1) || 1;
        }
    }

    public getRegion(loc: Vector) {
        const min = new Vector(-this.radius, -this.radius, -this.radius);
        const max = new Vector(this.radius, this.radius, this.radius);

        if (this.directionSign > 0) {
            min[this.axis] = 0;
            max[this.axis] = this.height - 1;
        } else {
            min[this.axis] = -(this.height - 1);
            max[this.axis] = 0;
        }

        return <[Vector, Vector]>[loc.add(min), loc.add(max)];
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
    }

    public getOutline() {
        const radius = this.radius + 0.5;

        const localPoint = (length: number, crossA: number, crossB: number) => {
            const point = new Vector(0, 0, 0);
            point[this.axis] = length * this.directionSign;
            point[this.crossAxes[0]] = crossA;
            point[this.crossAxes[1]] = crossB;
            return point;
        };

        const tip = localPoint(this.height, 0, 0);
        const vertices = [localPoint(0, radius, 0), localPoint(0, -radius, 0), localPoint(0, 0, radius), localPoint(0, 0, -radius), tip];

        const edges: [number, number][] = [
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
        ];

        return [...this.drawCircle(new Vector(0, 0, 0), radius, this.axis), ...this.drawShape(vertices, edges)];
    }

    protected prepGeneration(genVars: shapeGenVars) {
        genVars.radius = this.radius;
        genVars.height = this.height;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const distance = relLoc[this.axis] * this.directionSign;

        if (distance < 0 || distance >= genVars.height) {
            return false;
        }

        const radius = genVars.height === 1 ? genVars.radius + 0.5 : genVars.radius + 0.5 - (genVars.radius * distance) / (genVars.height - 1);

        const a = relLoc[this.crossAxes[0]] / radius;
        const b = relLoc[this.crossAxes[1]] / radius;

        return a * a + b * b <= 1.0;
    }
}
