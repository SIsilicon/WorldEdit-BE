import { brushTypes } from "./base_brush.js";
import { CylinderShape } from "../shapes/cylinder.js";
import { Pattern } from "@modules/pattern.js";
import { ShapeBrush } from "./shape_brush.js";

/**
 * This brush creates cylinder shaped patterns in the world.
 */
export class CylinderBrush extends ShapeBrush {
    public readonly id = "cylinder_brush";

    private height: number;
    private radius: number;

    /**
     * @param radius The radius of the cylinders
     * @param height The height of the cylinders
     * @param pattern The pattern the cylinders will be made of
     * @param hollow Whether the cylinders will be made hollow
     */
    constructor(radius: number, height: number, pattern: Pattern, hollow: boolean) {
        super(pattern, hollow);
        this.assertSizeInRange(radius);
        this.shape = new CylinderShape(height, radius);
        this.shape.usedInBrush = true;
        this.height = height;
        this.radius = radius;
    }

    protected get gradientRadius() {
        return Math.max(this.radius, this.height / 2);
    }

    public resize(value: number) {
        this.assertSizeInRange(value);
        this.shape = new CylinderShape(this.height, value);
        this.shape.usedInBrush = true;
        this.radius = value;
    }

    public getSize() {
        return this.radius;
    }

    public getHeight() {
        return this.height;
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            height: this.height,
            pattern: this.pattern,
            hollow: this.hollow,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.height, new Pattern(json.pattern), json.hollow];
    }
}
brushTypes.set("cylinder_brush", CylinderBrush);
