import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";

class CommandTool extends Tool {
  public command: string;
  public isCustom = false;

  constructor(command: string) {
    super();
    if (command.startsWith(";")) {
      this.isCustom = true;
      this.command = command.slice(1);
    } else if (command.startsWith("/")) {
      this.isCustom = false;
      this.command = command.slice(1);
    } else {
      this.command = command;
    }
  }

  use = function (self: CommandTool, player: Player, session: PlayerSession) {
    if (self.isCustom) {
      const firstSpace = self.command.indexOf(" ");
      const usingItem = session.usingItem;
      session.usingItem = false;
      Server.command.callCommand(player, self.command.substring(0, firstSpace).trim(), self.command.substring(firstSpace).trim());
      session.usingItem = usingItem;
    } else {
      if (player.isOp()) {
        Server.runCommand(self.command, player);
      }
    }
  };
}
Tools.register(CommandTool, "command_wand");
