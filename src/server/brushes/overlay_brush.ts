import { Server, Vector, VectorSet, regionIterateBlocks } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { Mask } from "@modules/mask.js";
import { getWorldHeightLimits } from "server/util.js";
import { Pattern } from "@modules/pattern.js";
import { recordBlockChanges } from "@modules/block_changes.js";
import { CylinderShape } from "server/shapes/cylinder.js";
import { Shape } from "server/shapes/base_shape.js";
import { Vector3 } from "@minecraft/server";

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

    public *apply(locations: Vector[], session: PlayerSession, mask?: Mask) {
        const minY = getWorldHeightLimits(session.player.dimension)[0];
        const activeMask = (!mask ? session.globalMask : session.globalMask ? mask.intersect(session.globalMask) : mask)?.withContext(session);
        const surfaceMask = this.surfaceMask.withContext(session);
        const isAirOrFluid = Server.block.isAirOrFluid;
        const r2 = Math.pow(this.radius + 0.5, 2);

        const history = session.history;
        const record = history.record();
        const blockChanges = recordBlockChanges(session, record);
        try {
            const affected = new VectorSet();
            for (const hit of locations) {
                const range: [Vector, Vector] = [hit.offset(-this.radius, 1, -this.radius), hit.offset(this.radius, 1, this.radius)];
                for (const loc of regionIterateBlocks(...range)) {
                    if (affected.has(loc) || hit.sub(loc).lengthSqr > r2 || !isAirOrFluid(blockChanges.getBlockPerm(loc))) {
                        continue;
                    }

                    affected.add(loc);
                    const trace = Vector.sub(loc, [0, 1, 0]);
                    while (trace.y >= minY) {
                        const block = blockChanges.getBlock(trace);
                        if (!isAirOrFluid(block.permutation) && surfaceMask.matchesBlock(block)) {
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
            }

            yield* blockChanges.flush();
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    }

    public getOutline(): [Shape, Vector3] {
        return [new CylinderShape(1, this.radius), Vector.ZERO];
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
