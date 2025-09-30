import { CommandPermissionLevel, Player } from "@minecraft/server";
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

    use(player: Player, session: PlayerSession) {
        if (this.isCustom) {
            let firstSpace = this.command.indexOf(" ");
            if (firstSpace == -1) firstSpace = this.command.length;
            const usingItem = session.usingItem;
            session.usingItem = false;
            Server.command.callCommand(player, this.command.substring(0, firstSpace).trim(), this.command.substring(firstSpace).trim());
            session.usingItem = usingItem;
        } else {
            if (player.commandPermissionLevel >= CommandPermissionLevel.GameDirectors) Server.queueCommand(this.command, player);
        }
    }

    toJSON() {
        return {
            toolType: this.type,
            command: (this.isCustom ? ";" : "/") + this.command,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        return [json.command];
    }
}
Tools.register(CommandTool, "command_wand");
