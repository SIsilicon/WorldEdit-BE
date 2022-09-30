import { Player } from "mojang-minecraft";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { PlayerUtil } from "@modules/player_util.js";
import { Server } from "@notbeer-api";
import { PlayerSession } from "server/sessions.js";

class NavigationTool extends Tool {
  permission = "worldedit.navigation";

  use = function (self: Tool, player: Player, session: PlayerSession) {
    session.usingItem = true;
    if (player.dimension.getBlock(PlayerUtil.getBlockLocation(player).offset(0, 1, 0)).type.id != "minecraft:air") {
      Server.command.callCommand(player, "unstuck", []);
    } else if (player.isSneaking) {
      Server.command.callCommand(player, "thru", []);
    } else {
      Server.command.callCommand(player, "jumpto", []);
    }
    session.usingItem = false;
  };
}
Tools.register(NavigationTool, "navigation_wand");