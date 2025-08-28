import { Player } from "@minecraft/server";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";
import { Server, Vector } from "@notbeer-api";
import { PlayerSession } from "server/sessions";

class AddLoftPointTool extends Tool {
    permission = "worldedit.generation.shape";

    use = function (self: Tool, player: Player) {
        Server.command.callCommand(player, "loft", [
            "add_point",
            ...Vector.from(player.location)
                .floor()
                .toArray()
                .map((v) => `${v}`),
        ]);
    };

    useOn = function (self: Tool, player: Player, session: PlayerSession, location: Vector) {
        Server.command.callCommand(player, "loft", [
            "add_point",
            ...Vector.from(location)
                .toArray()
                .map((v) => `${v}`),
        ]);
    };
}
Tools.register(AddLoftPointTool, "add_loft_point", "wedit:add_loft_point");

class StartLoftCurveTool extends Tool {
    permission = "worldedit.generation.shape";

    use = function (self: Tool, player: Player) {
        Server.command.callCommand(player, "loft", [
            "start_curve",
            ...Vector.from(player.location)
                .floor()
                .toArray()
                .map((v) => `${v}`),
        ]);
    };

    useOn = function (self: Tool, player: Player, session: PlayerSession, location: Vector) {
        Server.command.callCommand(player, "loft", [
            "start_curve",
            ...Vector.from(location)
                .toArray()
                .map((v) => `${v}`),
        ]);
    };
}
Tools.register(StartLoftCurveTool, "start_loft_curve", "wedit:start_loft_curve");

class RemoveLoftPointTool extends Tool {
    permission = "worldedit.generation.shape";

    use = function (self: Tool, player: Player) {
        Server.command.callCommand(player, "loft", ["remove"]);
    };
}
Tools.register(RemoveLoftPointTool, "remove_loft_point", "wedit:remove_loft_point");

class ClearLoftPointsTool extends Tool {
    permission = "worldedit.generation.shape";

    use = function (self: Tool, player: Player) {
        Server.command.callCommand(player, "loft", ["clear"]);
    };
}
Tools.register(ClearLoftPointsTool, "clear_loft_point", "wedit:clear_loft_points");

class FillLoftTool extends Tool {
    permission = "worldedit.generation.shape";

    use = function (self: Tool, player: Player) {
        Server.command.callCommand(player, "loft", ["set", "air"]);
    };
}
Tools.register(FillLoftTool, "fill_loft", "wedit:fill_loft");
