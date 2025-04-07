import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { SphereShape } from "../shapes/sphere.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Shape } from "server/shapes/base_shape.js";

/**
 * This brush creates sphere shaped patterns in the world.
 */
export class SphereBrush extends Brush {
    public readonly id = "sphere_brush";

    private shape: SphereShape;
    private pattern: Pattern;
    private hollow: boolean;
    private radius: number;

    /**
     * @param radius The radius of the spheres
     * @param pattern The pattern the spheres will be made of
     * @param hollow Whether the spheres will be made hollow
     */
    constructor(radius: number, pattern: Pattern, hollow: boolean) {
        super();
        this.assertSizeInRange(radius);
        this.shape = new SphereShape(radius);
        this.shape.usedInBrush = true;
        this.pattern = pattern;
        this.hollow = hollow;
        this.radius = radius;
    }

    public resize(value: number) {
        this.assertSizeInRange(value);
        this.shape = new SphereShape(value);
        this.shape.usedInBrush = true;
        this.radius = value;
    }

    public getSize(): number {
        return this.radius;
    }

    public paintWith(value: Pattern) {
        this.pattern = value;
    }

    public getPattern(): Pattern {
        return this.pattern;
    }

    public isHollow(): boolean {
        return this.hollow;
    }

    public *apply(loc: Vector, session: PlayerSession, mask?: Mask) {
        yield* this.shape.generate(loc, this.pattern, mask, session, { hollow: this.hollow });
    }

    public getOutline(): [Shape, Vector] {
        return [this.shape, Vector.ZERO];
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
