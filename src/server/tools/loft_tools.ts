import { Player } from "@minecraft/server";
import { Server, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";

class LoftWandTool extends Tool {
    permission = "worldedit.generation.shape";

    break(player: Player, session: PlayerSession, location: Vector) {
        Server.command.callCommand(player, "loft", [
            "frame",
            ...Vector.from(location)
                .toArray()
                .map((value) => `${value}`),
        ]);
    }

    useOn(player: Player, session: PlayerSession, location: Vector) {
        Server.command.callCommand(player, "loft", [
            "point",
            ...Vector.from(location)
                .toArray()
                .map((value) => `${value}`),
        ]);
    }
}

Tools.register(LoftWandTool, "loft_wand");
