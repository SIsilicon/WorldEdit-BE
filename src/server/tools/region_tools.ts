import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";
import { assertCuboidSelection } from "@modules/assert";

class SelectionFillTool extends Tool {
    permission = "worldedit.region.replace";

    use(player: Player, session: PlayerSession) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            if (session.globalMask.empty()) {
                Server.command.callCommand(player, "set", ["air"]);
            } else {
                Server.command.callCommand(player, "replace", ["air", "air"]);
            }
        }
    }
}
Tools.register(SelectionFillTool, "selection_fill", "wedit:selection_fill");

class SelectionWallTool extends Tool {
    permission = "worldedit.region.walls";

    use(player: Player) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            Server.command.callCommand(player, "walls", ["air"]);
        }
    }
}
Tools.register(SelectionWallTool, "selection_wall", "wedit:selection_wall");

class SelectionOutlineTool extends Tool {
    permission = "worldedit.region.faces";

    use(player: Player) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            Server.command.callCommand(player, "faces", ["air"]);
        }
    }
}
Tools.register(SelectionOutlineTool, "selection_outline", "wedit:selection_outline");

class SelectionHollowTool extends Tool {
    permission = "worldedit.region.hollow";

    use(player: Player) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            Server.command.callCommand(player, "hollow", ["1"]);
        }
    }
}
Tools.register(SelectionHollowTool, "selection_hollow", "wedit:selection_hollow");

class SelectionStackTool extends Tool {
    permission = "worldedit.region.stack";

    use(player: Player, session: PlayerSession) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            assertCuboidSelection(session);
            Server.uiForms.show("$stackAmount", player);
        }
    }
}
Tools.register(SelectionStackTool, "selection_stack", "wedit:selection_stack");

class SelectionMoveTool extends Tool {
    permission = "worldedit.region.move";

    use(player: Player, session: PlayerSession) {
        if (Server.player.isSneaking(player)) {
            Server.uiForms.show("$selectRegionMode", player);
        } else {
            assertCuboidSelection(session);
            Server.uiForms.show("$moveAmount", player);
        }
    }
}
Tools.register(SelectionMoveTool, "selection_move", "wedit:selection_move");
