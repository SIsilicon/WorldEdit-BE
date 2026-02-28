import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { CuboidShape } from "../shapes/cuboid.js";
import { Mask } from "@modules/mask.js";
import { smooth } from "../commands/region/heightmap_func.js";
import { Shape } from "server/shapes/base_shape.js";
import { Vector3 } from "@minecraft/server";

/**
 * This smooths the terrain in the world.
 */
export class SmoothBrush extends Brush {
    public readonly id = "smooth_brush";

    public iterations: number;
    public heightMask: Mask;

    private shape: CuboidShape;
    private _radius: number;

    /**
     * @param radius The radius of the smoothing area
     * @param iterations The number of times the area is smoothed
     * @param mask determine what blocks affect the height map
     */
    constructor(radius: number, iterations: number, mask: Mask) {
        super();
        this.radius = radius;
        this.iterations = iterations;
        this.heightMask = mask;
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(value: number) {
        this.assertSizeInRange(value);
        this.shape = new CuboidShape(value * 2 + 1, value * 2 + 1, value * 2 + 1);
        this._radius = value;
    }

    public getIterations() {
        return this.iterations;
    }

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const points = locations.map((location) => location.sub(this.radius));
        yield* smooth(session, this.iterations, this.shape, points, this.heightMask, mask);
    }

    public getOutline(): [Shape, Vector3] {
        return [new CuboidShape(this.radius * 2, this.radius * 2, this.radius * 2), Vector.ONE.mul(-this.radius)];
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            iterations: this.iterations,
            mask: this.heightMask,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.iterations, new Mask(json.mask)];
    }
}
brushTypes.set("smooth_brush", SmoothBrush);
