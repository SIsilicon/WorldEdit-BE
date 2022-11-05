/* eslint-disable @typescript-eslint/no-unused-vars */
import { BlockLocation, Player, world } from "@minecraft/server";
import { contentLog, regionSize, regionTransformedBounds, Server, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { RawText } from "@notbeer-api";
import { PlayerUtil } from "@modules/player_util.js";
import { Selection } from "@modules/selection.js";
import { print } from "server/util.js";

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
    if (!session.clipboard) {
      return;
    }

    if (!self.outlines.has(session)) {
      const selection = new Selection(player);
      selection.mode = "cuboid";
      self.outlines.set(session, selection);
    }

    const rotation = session.clipboardTransform.rotation;
    const flip = session.clipboardTransform.flip;
    const bounds = regionTransformedBounds(Vector.ZERO.toBlock(), session.clipboard.getSize().offset(-1, -1, -1), Vector.ZERO, rotation, flip);
    const size = Vector.from(regionSize(bounds[0], bounds[1]));

    const loc = PlayerUtil.getBlockLocation(player);
    const pasteStart = Vector.add(loc, session.clipboardTransform.relative).sub(size.mul(0.5).sub(1));
    const pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE)).toBlock();

    const selection = self.outlines.get(session);
    selection.set(0, pasteStart.toBlock());
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
    Server.command.callCommand(player, "rotate", args).join();
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
    Server.runCommand("setblock ~~~ glass", player);
  };
}
Tools.register(SpawnGlassTool, "spawn_glass", "wedit:spawn_glass");

class SelectionFillTool extends Tool {
  permission = "worldedit.region.replace";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    if (session.globalMask.empty()) {
      Server.command.callCommand(player, "set", ["air"]);
    } else {
      Server.command.callCommand(player, "replace", ["air", "air"]);
    }
  };
}
Tools.register(SelectionFillTool, "selection_fill", "wedit:selection_fill");

class SelectionWallTool extends CommandButton {
  permission = "worldedit.region.walls";
  command = ["walls", "air"];
}
Tools.register(SelectionWallTool, "selection_wall", "wedit:selection_wall");

class SelectionOutlineTool extends CommandButton {
  permission = "worldedit.region.faces";
  command = ["faces", "air"];
}
Tools.register(SelectionOutlineTool, "selection_outline", "wedit:selection_outline");

class DrawLineTool extends CommandButton {
  permission = "worldedit.region.line";
  command = ["line", "air"];
}
Tools.register(DrawLineTool, "draw_line", "wedit:draw_line");

class ConfigTool extends Tool {
  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.enterSettings();
  };
}
Tools.register(ConfigTool, "config", "wedit:config_button");
