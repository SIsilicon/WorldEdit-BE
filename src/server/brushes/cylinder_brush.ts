import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { CylinderShape } from "../shapes/cylinder.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Selection } from "@modules/selection.js";

/**
 * This brush creates cylinder shaped patterns in the world.
 */
export class CylinderBrush extends Brush {
    public readonly id = "cylinder_brush";

    private shape: CylinderShape;
    private pattern: Pattern;
    private height: number;
    private hollow: boolean;
    private radius: number;

    /**
     * @param radius The radius of the cylinders
     * @param height The height of the cylinders
     * @param pattern The pattern the cylinders will be made of
     * @param hollow Whether the cylinders will be made hollow
     */
    constructor(radius: number, height: number, pattern: Pattern, hollow: boolean) {
        super();
        this.assertSizeInRange(radius);
        this.shape = new CylinderShape(height, radius);
        this.shape.usedInBrush = true;
        this.height = height;
        this.pattern = pattern;
        this.hollow = hollow;
        this.radius = radius;
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

    public isHollow() {
        return this.hollow;
    }

    public paintWith(value: Pattern) {
        this.pattern = value;
    }

    public getPattern(): Pattern {
        return this.pattern;
    }

    public *apply(loc: Vector, session: PlayerSession, mask?: Mask) {
        yield* this.shape.generate(loc, this.pattern, mask, session, { hollow: this.hollow });
    }

    public updateOutline(selection: Selection, loc: Vector): void {
        const region = this.shape.getRegion(loc);
        selection.mode = "cylinder";
        selection.set(0, new Vector(loc.x, region[0].y, loc.z));
        selection.set(1, new Vector(loc.x + this.radius, region[1].y, loc.z));
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
