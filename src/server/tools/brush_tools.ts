import { Player, system } from "@minecraft/server";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { brushConstruct, brushTypes, Brush } from "../brushes/base_brush.js";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { everyCall, Vector, VectorSet } from "@notbeer-api";

const outlines = new WeakMap<PlayerSession, { lastHit: Vector; lazyCall: (cb: () => any) => void }>();
const strokes = new WeakMap<PlayerSession, { lastUseTick: number; hits: VectorSet<Vector>; tempHits: Vector[] }>();

class BrushTool extends Tool {
    public brush: Brush;

    public range: number = null;
    public mask: Mask = null;
    public traceMask: Mask = null;

    permission = "worldedit.brush";
    noDelay = true;

    constructor(brush: Brush, mask?: Mask, traceMask?: Mask) {
        super();
        this.brush = brush;
        this.mask = mask;
        this.traceMask = traceMask;
    }

    *use(player: Player, session: PlayerSession) {
        const hit = PlayerUtil.traceForBlock(player, this.range, { mask: this.traceMask });
        if (this.brush.usesStrokes) {
            if (!strokes.has(session)) strokes.set(session, { lastUseTick: 0, hits: new VectorSet(), tempHits: [] });
            strokes.get(session).lastUseTick = system.currentTick;
            const { hits, tempHits } = strokes.get(session);
            for (const hit of tempHits) hits.add(hit);
            hits.add(hit);
            tempHits.length = 0;
        } else {
            yield* this.brush.apply([hit], session, this.mask);
        }
    }

    stopHold(player: Player, session: PlayerSession) {
        strokes.delete(session);
    }

    *tick(player: Player, session: PlayerSession) {
        const hit = PlayerUtil.traceForBlock(player, this.range, { mask: this.traceMask });

        // Process brush stroke
        if (strokes.has(session)) {
            const { lastUseTick, hits, tempHits } = strokes.get(session);
            if (system.currentTick > lastUseTick + 5) {
                strokes.delete(session);
                yield* this.brush.apply(Array.from(hits.values()), session, this.mask);
            } else if (hit) {
                tempHits.push(hit);
            }
        }
        // Process brush outline
        if (session.drawOutlines && hit) {
            if (!outlines.has(session)) outlines.set(session, { lastHit: hit, lazyCall: everyCall(4) });

            const [shape, offset] = this.brush.getOutline();
            const { lastHit, lazyCall } = outlines.get(session);
            if (lastHit && !lastHit.equals(hit)) shape.draw(player, Vector.add(hit, offset));
            else lazyCall(() => shape.draw(player, Vector.add(hit, offset)));
            outlines.get(session).lastHit = hit;
        }

        yield;
    }

    set size(value: number) {
        this.brush.resize(value);
    }

    set material(value: Pattern) {
        this.brush.paintWith(value);
    }

    delete() {
        super.delete();
        this.brush.delete();
    }

    toJSON() {
        // persistent structure brush not supported
        if (this.brush.id === "structure_brush") return undefined;

        return {
            toolType: this.type,
            brush: this.brush,
            mask: this.mask,
            traceMask: this.traceMask,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        const brushClass = brushTypes.get(json.brush.id);
        const brush = new brushClass(...(brushClass as brushConstruct & typeof Brush).parseJSON(json.brush));
        return [brush, json.mask ? new Mask(json.mask) : null, json.traceMask ? new Mask(json.traceMask) : null];
    }
}
Tools.register(BrushTool, "brush");
