/* eslint-disable @typescript-eslint/no-unused-vars */
import { Vector3, Player, system } from "@minecraft/server";
import { RawText, regionBounds, regionSize, regionTransformedBounds, Server, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { PlayerUtil } from "@modules/player_util.js";
import { Selection } from "@modules/selection.js";
import { generateLine } from "server/commands/region/line.js";

abstract class CommandButton extends Tool {
    abstract readonly command: string | string[];

    use = function (self: CommandButton, player: Player, session: PlayerSession) {
      if (typeof self.command == "string") {
        Server.command.callCommand(player, self.command);
      } else {
        Server.command.callCommand(player, self.command[0], self.command.slice(1));
      }
    };
}

class CutTool extends CommandButton {
  command = "cut";
  permission = "worldedit.clipboard.cut";
}
Tools.register(CutTool, "cut", "wedit:cut_button");

class CopyTool extends CommandButton {
  command = "copy";
  permission = "worldedit.clipboard.copy";
}
Tools.register(CopyTool, "copy", "wedit:copy_button");

class PasteTool extends CommandButton {
  command = ["paste", "-s"];
  permission = "worldedit.clipboard.paste";

  outlines = new Map<PlayerSession, Selection>();

  use = function (self: CommandButton, player: Player, session: PlayerSession) {
    Server.command.callCommand(player, self.command[0], self.command.slice(1) as string[]);
  };

  tick = function* (self: PasteTool, player: Player, session: PlayerSession, tick: number): Generator<void> {
    if (!session.clipboard || !session.drawOutlines) {
      return;
    }

    if (!self.outlines.has(session)) {
      const selection = new Selection(player);
      selection.mode = "cuboid";
      self.outlines.set(session, selection);
    }
    const rotation = session.clipboardTransform.rotation;
    const flip = session.clipboardTransform.flip;
    const bounds = regionTransformedBounds(Vector.ZERO.floor(), session.clipboard.getSize().offset(-1, -1, -1), Vector.ZERO, rotation, flip);
    const size = Vector.from(regionSize(bounds[0], bounds[1]));

    const loc = PlayerUtil.getBlockLocation(player);
    const pasteStart = Vector.add(loc, session.clipboardTransform.relative).sub(size.mul(0.5).sub(1));
    const pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE)).floor();

    const selection = self.outlines.get(session);
    selection.set(0, pasteStart.floor());
    selection.set(1, pasteEnd);
    selection.draw();
    yield;
  };
}
Tools.register(PasteTool, "paste", "wedit:paste_button");

class UndoTool extends CommandButton {
  command = "undo";
  permission = "worldedit.history.undo";
}
Tools.register(UndoTool, "undo", "wedit:undo_button");

class RedoTool extends CommandButton {
  command = "redo";
  permission = "worldedit.history.redo";
}
Tools.register(RedoTool, "redo", "wedit:redo_button");

class RotateCWTool extends Tool {
  permission = "worldedit.region.rotate";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    const args = ["90", "-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "rotate", args);
  };
}
Tools.register(RotateCWTool, "rotate_cw", "wedit:rotate_cw_button");

class RotateCCWTool extends Tool {
  permission = "worldedit.region.rotate";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    const args = ["-90", "-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "rotate", args);
  };
}
Tools.register(RotateCCWTool, "rotate_ccw", "wedit:rotate_ccw_button");

class FlipTool extends Tool {
  permission = "worldedit.region.flip";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    const args = ["-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "flip", args);
  };
}
Tools.register(FlipTool, "flip", "wedit:flip_button");

class SpawnGlassTool extends Tool {
  use = function (self: Tool, player: Player) {
    Server.queueCommand("setblock ~~~ glass", player);
  };
}
Tools.register(SpawnGlassTool, "spawn_glass", "wedit:spawn_glass");

class DrawLineTool extends Tool {
  permission = "worldedit.region.line";

  private lineStart = new Map<PlayerSession, Vector>();

  useOn = function* (self: DrawLineTool, player: Player, session: PlayerSession, loc: Vector3) {
    if (session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";
    if (!self.lineStart.has(session)) {
      self.lineStart.set(session, Vector.from(loc));
      return;
    }

    const pos1 = self.lineStart.get(session);
    const pos2 = Vector.from(loc);
    const [start, end] = regionBounds([pos1, pos2]);
    self.lineStart.delete(session);

    const dim = player.dimension;
    const pattern = session.globalPattern;  
    pattern.setContext(session, [start, end]);
  
    const history = session.getHistory();
    const record = history.record();
    let count: number;
    try {
      const points = (yield* generateLine(pos1, pos2)).map(p => p.floor());
      history.addUndoStructure(record, start, end);
      count = 0;
      for (const point of points) {
        const block = dim.getBlock(point);
        if (session.globalMask.matchesBlock(block) && pattern.setBlock(block)) {
          count++;
        }
        yield;
      }
  
      history.recordSelection(record, session);
      history.addRedoStructure(record, start, end);
      history.commit(record);
    } catch (e) {
      history.cancel(record);
      throw e;
    }
  
    self.log(RawText.translate("commands.blocks.wedit:changed").with(`${count}`));
  }

  tick = function* (self: DrawLineTool, player: Player, session: PlayerSession) {
    if (system.currentTick % 5 !== 0 || !self.lineStart.has(session) || !session.drawOutlines) {
      return;
    }

    let lineStart = self.lineStart.get(session);
    const lineEnd = PlayerUtil.traceForBlock(player, 6);
    const length = lineEnd.sub(lineStart).length;
    const dim = player.dimension;
    if (length > 32) {
      lineStart = lineEnd.add(lineStart.sub(lineEnd).normalized().mul(32)).floor();
    }

    const genLine = generateLine(lineStart, lineEnd);
    let val: IteratorResult<void, Vector3[]>;
    while (!val?.done) val = genLine.next();
    val.value.forEach((p) => {
      dim.spawnParticle("wedit:selection_draw", p);
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [1, 0, 0]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [0, 1, 0]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [1, 1, 0]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [0, 0, 1]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [1, 0, 1]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [0, 1, 1]));
      dim.spawnParticle("wedit:selection_draw", Vector.add(p, [1, 1, 1]));
    });
  }
}
Tools.register(DrawLineTool, "draw_line", "wedit:draw_line");

class ConfigTool extends Tool {
  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.enterSettings();
  };
}
Tools.register(ConfigTool, "config", "wedit:config_button");
