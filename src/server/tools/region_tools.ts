import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";

class SelectionFillTool extends Tool {
  permission = "worldedit.region.replace";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    if (player.isSneaking) {
      Server.uiForms.show("$selectRegionMode", player);
    } else {
      if (session.globalMask.empty()) {
        Server.command.callCommand(player, "set", ["air"]);
      } else {
        Server.command.callCommand(player, "replace", ["air", "air"]);
      }
    }
  };
}
Tools.register(SelectionFillTool, "selection_fill", "wedit:selection_fill");

class SelectionWallTool extends Tool {
  permission = "worldedit.region.walls";

  use = function (self: Tool, player: Player) {
    if (player.isSneaking) {
      Server.uiForms.show("$selectRegionMode", player);
    } else {
      Server.command.callCommand(player, "walls", ["air"]);
    }
  };
}
Tools.register(SelectionWallTool, "selection_wall", "wedit:selection_wall");

class SelectionOutlineTool extends Tool {
  permission = "worldedit.region.faces";

  use = function (self: Tool, player: Player) {
    if (player.isSneaking) {
      Server.uiForms.show("$selectRegionMode", player);
    } else {
      Server.command.callCommand(player, "faces", ["air"]);
    }
  };
}
Tools.register(SelectionOutlineTool, "selection_outline", "wedit:selection_outline");

class SelectionHollowTool extends Tool {
  permission = "worldedit.region.hollow";

  use = function (self: Tool, player: Player) {
    if (player.isSneaking) {
      Server.uiForms.show("$selectRegionMode", player);
    } else {
      Server.command.callCommand(player, "hollow", ["1"]);
    }
  };
}
Tools.register(SelectionHollowTool, "selection_hollow", "wedit:selection_hollow");
