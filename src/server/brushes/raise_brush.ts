import { Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { modifyHeight } from "../commands/region/heightmap_func.js";
import { Shape } from "server/shapes/base_shape.js";
import { Vector3 } from "@minecraft/server";
import { CylinderShape } from "server/shapes/cylinder.js";
import { closestPoint } from "library/utils/closestpoint.js";
import { Easing } from "@modules/easing.js";

/**
 * This smooths the terrain in the world.
 */
export class RaiseBrush extends Brush {
    public readonly id = "raise_brush";

    public height: number;
    public heightMask: Mask;
    public falloffType: Easing;
    public falloffAmount: number;

    private shape: CylinderShape;
    private _radius: number;

    /**
     * @param radius The radius of the smoothing area
     * @param iterations The number of times the area is smoothed
     * @param mask determine what blocks affect the height map
     */
    constructor(radius: number, height: number, mask: Mask, falloffType: Easing, falloffAmount: number) {
        super();
        this.radius = radius;
        this.height = height;
        this.heightMask = mask;
        this.falloffType = falloffType;
        this.falloffAmount = falloffAmount;
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(value: number) {
        this.assertSizeInRange(value);
        this.shape = new CylinderShape(value + 2, value);
        this._radius = value;
    }

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const closest = closestPoint(locations.map(({ x, z }) => ({ x, y: 0, z })));
        const getFalloff = (x: number, z: number) => {
            if (this.falloffAmount < 0.01) return 1;
            const center = closest({ x, y: 0, z });
            let value = (1 - Math.hypot(center.x - x, center.z - z) / this.radius) / this.falloffAmount;
            value = Math.min(Math.max(value, 0), 1);
            return this.falloffType.evaluate(value);
        };

        yield* modifyHeight(
            session,
            function* (this: RaiseBrush, map, API) {
                yield* API.modifyMap(
                    map,
                    ({ x, z }) => {
                        const column = API.getColumn(map, x, z);
                        column.height += (this.height + 0.5) * getFalloff(x, z);
                    },
                    ""
                );
            }.bind(this),
            this.shape,
            locations,
            this.heightMask,
            mask
        );
    }

    public getOutline(): [Shape, Vector3] {
        return [new CylinderShape(this.radius + 2, this.radius), Vector.ZERO];
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            height: this.height,
            mask: this.heightMask,
            falloffType: this.falloffType,
            falloffAmount: this.falloffAmount,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.height, new Mask(json.mask), new Easing(json.falloffType), json.falloffAmount];
    }
}
brushTypes.set("raise_brush", RaiseBrush);
