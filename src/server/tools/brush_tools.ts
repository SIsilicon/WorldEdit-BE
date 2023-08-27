import { Player } from "@minecraft/server";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { brushConstruct, brushTypes, Brush } from "../brushes/base_brush.js";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { Selection } from "@modules/selection.js";
import { Vector } from "@notbeer-api";

class BrushTool extends Tool {
  public brush: Brush;

  public range: number = null;
  public mask: Mask = null;
  public traceMask: Mask = null;

  permission = "worldedit.brush";

  private outlines = new Map<PlayerSession, {selection: Selection, lastHit: Vector}>();
  private prevTick = 0;
  private ticksToUpdate = 0;

  use = function* (self: BrushTool, player: Player, session: PlayerSession) {
    const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
    if (!hit) {
      throw "commands.wedit:jumpto.none";
    }
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
      if (!self.outlines.has(session)) {
        const selection = new Selection(player);
        self.outlines.set(session, {selection, lastHit: hit});
      }

      const { selection, lastHit } = self.outlines.get(session);
      self.brush.updateOutline(selection, hit);
      if (lastHit && !lastHit.equals(hit)) {
        selection.forceDraw();
      } else {
        selection.draw();
      }
      self.outlines.get(session).lastHit = hit;
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
      type: this.type,
      brush: this.brush,
      mask: this.mask?.getSource() ?? null,
      traceMask: this.traceMask?.getSource() ?? null
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseJSON(json: {[key: string]: any}) {
    const brushClass = brushTypes.get(json.brush.id);
    const brush = new brushClass(...(brushClass as brushConstruct & typeof Brush).parseJSON(json.brush));
    return [brush, json.mask ? new Mask(json.mask) : null, json.traceMask ? new Mask(json.traceMask) : null];
  }
}
Tools.register(BrushTool, "brush");
