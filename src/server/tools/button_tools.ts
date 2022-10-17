import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { RawText } from "@notbeer-api";

abstract class CommandButton extends Tool {
    abstract readonly command: string | string[];

    use = function (self: CommandButton, player: Player, session: PlayerSession) {
      session.usingItem = true;
      if (typeof self.command == "string") {
        Server.command.callCommand(player, self.command);
      } else {
        Server.command.callCommand(player, self.command[0], self.command.slice(1));
      }
      session.usingItem = false;
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
    session.usingItem = true;
    const args = ["90", "-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "rotate", args).join();
    session.usingItem = false;
  };
}
Tools.register(RotateCWTool, "rotate_cw", "wedit:rotate_cw_button");

class RotateCCWTool extends Tool {
  permission = "worldedit.region.rotate";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.usingItem = true;
    const args = ["-90", "-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "rotate", args);
    session.usingItem = false;
  };
}
Tools.register(RotateCCWTool, "rotate_ccw", "wedit:rotate_ccw_button");

class FlipTool extends Tool {
  permission = "worldedit.region.flip";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.usingItem = true;
    const args = ["-sw"];
    if (player.isSneaking) {
      args.push("-o");
    }
    Server.command.callCommand(player, "flip", args);
    session.usingItem = false;
  };
}
Tools.register(FlipTool, "flip", "wedit:flip_button");

class SpawnGlassTool extends Tool {
  use = function (self: Tool, player: Player) {
    if (Server.runCommand(`execute "${player.nameTag}" ~~~ setblock ~~~ glass`).error) {
      throw RawText.translate("worldedit.spawnGlass.error");
    }
  };
}
Tools.register(SpawnGlassTool, "spawn_glass", "wedit:spawn_glass");

class SelectionFillTool extends Tool {
  permission = "worldedit.region.replace";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.usingItem = true;
    if (session.globalMask.empty()) {
      Server.command.callCommand(player, "set", ["air"]);
    } else {
      Server.command.callCommand(player, "replace", ["air", "air"]);
    }
    session.usingItem = false;
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
