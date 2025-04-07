import { Player } from "@minecraft/server";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { brushConstruct, brushTypes, Brush } from "../brushes/base_brush.js";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { everyCall, Vector } from "@notbeer-api";

const outlines = new WeakMap<PlayerSession, { lastHit: Vector; lazyCall: (cb: () => any) => void }>();

class BrushTool extends Tool {
    public brush: Brush;

    public range: number = null;
    public mask: Mask = null;
    public traceMask: Mask = null;

    permission = "worldedit.brush";

    use = function* (self: BrushTool, player: Player, session: PlayerSession) {
        const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
        if (!hit) throw "commands.wedit:jumpto.none";
        yield* self.brush.apply(hit, session, self.mask);
    };

    tick = function* (self: BrushTool, player: Player, session: PlayerSession, tick: number): Generator<void> {
        this.ticksToUpdate -= tick - this.prevTick;
        this.prevTick = tick;
        if (this.ticksToUpdate > 0 || !session.drawOutlines) return;

        this.ticksToUpdate = 3;
        const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
        yield;
        if (hit) {
            if (!outlines.has(session)) outlines.set(session, { lastHit: hit, lazyCall: everyCall(4) });

            const [shape, offset] = self.brush.getOutline();
            const { lastHit, lazyCall } = outlines.get(session);
            if (lastHit && !lastHit.equals(hit)) shape.draw(player, Vector.add(hit, offset));
            else lazyCall(() => shape.draw(player, Vector.add(hit, offset)));
            outlines.get(session).lastHit = hit;
            yield;
        }
    };

    constructor(brush: Brush, mask?: Mask, traceMask?: Mask) {
        super();
        this.brush = brush;
        this.mask = mask;
        this.traceMask = traceMask;
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
