import { Server, Vector, regionIterateBlocks } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { Selection } from "@modules/selection.js";
import { getWorldHeightLimits } from "server/util.js";
import { Pattern } from "@modules/pattern.js";

/**
 * overlays terrain with blocks
 */
export class OverlayBrush extends Brush {
    public readonly id = "overlay_brush";

    private pattern: Pattern;
    private radius: number;
    private depth: number;
    private surfaceMask: Mask;

    /**
     * @param radius The radius of the brush (no limit to depth)
     * @param depth How far down the overlay will penetrate a surface
     * @param pattern The type of block(s) to overlay with
     * @param surfaceMask What is considered a surface
     */
    constructor(radius: number, depth: number, pattern: Pattern, surfaceMask: Mask) {
        super();
        this.assertSizeInRange(radius);
        this.pattern = pattern;
        this.radius = radius;
        this.depth = depth;
        this.surfaceMask = surfaceMask ?? new Mask();
    }

    public resize(value: number) {
        this.assertSizeInRange(value);
        this.radius = value;
    }

    public getSize(): number {
        return this.radius;
    }

    getDepth(): number {
        return this.depth;
    }

    public paintWith(value: Pattern) {
        this.pattern = value;
    }

    public getPattern(): Pattern {
        return this.pattern;
    }

    public *apply(hit: Vector, session: PlayerSession, mask?: Mask) {
        const range: [Vector, Vector] = [hit.offset(-this.radius, 1, -this.radius), hit.offset(this.radius, 1, this.radius)];
        const minY = getWorldHeightLimits(session.getPlayer().dimension)[0];
        const activeMask = !mask ? session.globalMask : session.globalMask ? mask.intersect(session.globalMask) : mask;
        const isAirOrFluid = Server.block.isAirOrFluid;
        const r2 = Math.pow(this.radius + 0.5, 2);

        const history = session.getHistory();
        const record = history.record();
        const blockChanges = history.collectBlockChanges(record);
        try {
            for (const loc of regionIterateBlocks(...range)) {
                if (hit.sub(loc).lengthSqr > r2 || !isAirOrFluid(blockChanges.getBlockPerm(loc))) {
                    continue;
                }

                const trace = Vector.sub(loc, [0, 1, 0]);
                while (trace.y >= minY) {
                    const block = blockChanges.getBlock(trace);
                    if (!isAirOrFluid(block.permutation) && this.surfaceMask.matchesBlock(block)) {
                        for (let i = 0; i < Math.abs(this.depth); i++) {
                            const block = blockChanges.getBlock(trace.offset(0, this.depth > 0 ? -i : i + 1, 0));
                            if (!activeMask || activeMask.matchesBlock(block)) {
                                this.pattern.setBlock(block);
                            }
                        }
                        break;
                    }
                    trace.y--;
                }
                yield;
            }

            yield* blockChanges.flush();
            history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    }

    public updateOutline(selection: Selection, loc: Vector): void {
        selection.mode = "cylinder";
        selection.set(0, loc);
        selection.set(1, loc.offset(0, 0, this.radius));
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            depth: this.depth,
            pattern: this.pattern,
            surfaceMask: this.surfaceMask,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.depth, new Pattern(json.pattern), new Mask(json.mask)];
    }
}
brushTypes.set("overlay_brush", OverlayBrush);
