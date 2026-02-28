import { brushTypes } from "./base_brush.js";
import { SphereShape } from "../shapes/sphere.js";
import { Pattern } from "@modules/pattern.js";
import { ShapeBrush } from "./shape_brush.js";

/**
 * This brush creates sphere shaped patterns in the world.
 */
export class SphereBrush extends ShapeBrush {
    public readonly id = "sphere_brush";

    private _radius: number;

    /**
     * @param radius The radius of the spheres
     * @param pattern The pattern the spheres will be made of
     * @param hollow Whether the spheres will be made hollow
     */
    constructor(radius: number, pattern: Pattern, hollow: boolean) {
        super(pattern, hollow);
        this.radius = radius;
    }

    protected get gradientRadius() {
        return this._radius;
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(value: number) {
        this.assertSizeInRange(value);
        this.shape = new SphereShape(value);
        this._radius = value;
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            pattern: this.pattern,
            hollow: this.hollow,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, new Pattern(json.pattern), json.hollow];
    }
}
brushTypes.set("sphere_brush", SphereBrush);
