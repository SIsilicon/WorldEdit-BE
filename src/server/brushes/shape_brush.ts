import { regionBounds, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { Shape } from "server/shapes/base_shape.js";
import { Jobs } from "@modules/jobs.js";
import { balloonPath } from "server/commands/region/paths_func.js";

/**
 * This brush creates sphere shaped patterns in the world.
 */
export abstract class ShapeBrush extends Brush {
    protected shape: Shape;
    protected pattern: Pattern;
    protected hollow: boolean;

    /**
     * @param pattern The pattern the shape will be made of
     * @param hollow Whether the shape will be made hollow
     */
    constructor(pattern: Pattern, hollow: boolean) {
        super();
        this.pattern = pattern;
        this.hollow = hollow;
    }

    protected abstract get gradientRadius(): number;

    public paintWith(value: Pattern) {
        this.pattern = value;
    }

    public getPattern(): Pattern {
        return this.pattern;
    }

    public isHollow(): boolean {
        return this.hollow;
    }

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const history = session.history;
        const record = history.record();
        try {
            const blocks = yield* balloonPath(locations, this.shape, { hollow: this.hollow });
            const range = regionBounds(blocks);
            const pattern = this.pattern.withContext(session, range, { strokePoints: locations, gradientRadius: this.gradientRadius });
            mask = session.globalMask.intersect(mask ?? new Mask()).withContext(session);

            yield* history.trackRegion(record, blocks);
            for (const point of blocks) {
                const block = yield* Jobs.loadBlock(point);
                if (mask.matchesBlock(block)) pattern.setBlock(block);
                yield;
            }
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    }

    public getOutline(): [Shape, Vector] {
        return [this.shape, Vector.ZERO];
    }
}
