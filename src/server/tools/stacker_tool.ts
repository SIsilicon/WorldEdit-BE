import { Cardinal } from "@modules/directions.js";
import { Mask } from "@modules/mask.js";
import { Vector, regionIterateBlocks } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { RegionBuffer } from "@modules/region_buffer.js";

class StackerTool extends Tool {
  public range: number;
  public mask: Mask;

  permission = "worldedit.region.stack";
  useOn = function* (self: StackerTool, player: Player, session: PlayerSession, loc: Vector) {
    const dim = player.dimension;
    const dir = new Cardinal(Cardinal.Dir.BACK).getDirection(player);
    const start = loc.add(dir);
    if (!self.mask.matchesBlock(dim.getBlock(start))) {
      return;
    }
    let end = loc;
    for (let i = 0; i < self.range; i++) {
      end = end.add(dir);
      if (!self.mask.matchesBlock(dim.getBlock(end.add(dir)))) break;
    }
    const history = session.getHistory();
    const record = history.record();
    const tempStack = new RegionBuffer(true);
    try {
      history.addUndoStructure(record, start, end, "any");

      yield tempStack.save(loc, loc, dim);
      for (const pos of regionIterateBlocks(start, end)) {
        tempStack.load(pos, dim);
      }
      history.addRedoStructure(record, start, end, "any");
      history.commit(record);
    } catch (e) {
      history.cancel(record);
      throw e;
    } finally {
      tempStack.deref();
    }
  };

  constructor(range: number, mask: Mask) {
    super();
    this.range = range;
    this.mask = mask;
  }
}

Tools.register(StackerTool, "stacker_wand");