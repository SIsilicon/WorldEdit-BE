import { BlockLocation, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Server } from "@notbeer-api";

class SelectionTool extends Tool {
  permission = "worldedit.selection.pos";
  useOn = function (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
    Server.command.callCommand(player, player.isSneaking ? "pos1" : "pos2",
      [`${loc.x}`, `${loc.y}`, `${loc.z}`]
    );
  };
  breakOn = function (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
    Server.command.callCommand(player, "pos1", [`${loc.x}`, `${loc.y}`, `${loc.z}`]);
  };
}
Tools.register(SelectionTool, "selection_wand");

class FarSelectionTool extends Tool {
  permission = "worldedit.selection.hpos";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  use = function (self: Tool, player: Player, session: PlayerSession) {
    Server.command.callCommand(player, player.isSneaking ? "hpos1" : "hpos2");
  };
}
Tools.register(FarSelectionTool, "far_selection_wand");