/* eslint-disable @typescript-eslint/no-unused-vars */
import { Player } from "@minecraft/server";
import { regionSize, regionTransformedBounds, Server, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { PlayerUtil } from "@modules/player_util.js";
import { Selection } from "@modules/selection.js";
import { rotationFlipMatrix } from "server/util.js";

interface PreviewPaste {
    outlines: Map<PlayerSession, Selection>;
    tick: typeof previewPaste;
}

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

class PasteTool extends CommandButton implements PreviewPaste {
    command = ["paste", "-s"];
    permission = "worldedit.clipboard.paste";

    use = function (self: CommandButton, player: Player, session: PlayerSession) {
        Server.command.callCommand(player, self.command[0], self.command.slice(1) as string[]);
    };

    outlines = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
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

class RotateCWTool extends Tool implements PreviewPaste {
    permission = "worldedit.region.rotate";

    use = function (self: Tool, player: Player, session: PlayerSession) {
        const args = ["90"];
        if (player.isSneaking) args.push("-o");
        Server.command.callCommand(player, "rotate", args);
    };

    outlines = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(RotateCWTool, "rotate_cw", "wedit:rotate_cw_button");

class RotateCCWTool extends Tool implements PreviewPaste {
    permission = "worldedit.region.rotate";

    use = function (self: Tool, player: Player, session: PlayerSession) {
        const args = ["-90"];
        if (player.isSneaking) args.push("-o");
        Server.command.callCommand(player, "rotate", args);
    };

    outlines = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(RotateCCWTool, "rotate_ccw", "wedit:rotate_ccw_button");

class FlipTool extends Tool implements PreviewPaste {
    permission = "worldedit.region.flip";

    use = function (self: Tool, player: Player, session: PlayerSession) {
        const args = [];
        if (player.isSneaking) args.push("-o");
        Server.command.callCommand(player, "flip", args);
    };

    outlines = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(FlipTool, "flip", "wedit:flip_button");

class SpawnGlassTool extends Tool {
    use = function (self: Tool, player: Player) {
        Server.queueCommand("setblock ~~~ glass", player);
    };
}
Tools.register(SpawnGlassTool, "spawn_glass", "wedit:spawn_glass");

class ConfigTool extends Tool {
    use = function (self: Tool, player: Player, session: PlayerSession) {
        session.enterSettings();
    };
}
Tools.register(ConfigTool, "config", "wedit:config_button");

function* previewPaste(self: PreviewPaste, player: Player, session: PlayerSession): Generator<void> {
    if (!session.clipboard || !session.drawOutlines) return;

    if (!self.outlines.has(session)) {
        const selection = new Selection(player);
        self.outlines.set(session, selection);
    }
    const rotation = session.clipboardTransform.rotation;
    const flip = session.clipboardTransform.flip;
    const bounds = regionTransformedBounds(Vector.ZERO.floor(), session.clipboard.getSize().offset(-1, -1, -1), rotationFlipMatrix(rotation, flip));
    const size = Vector.from(regionSize(bounds[0], bounds[1]));

    const loc = PlayerUtil.getBlockLocation(player);
    const pasteStart = Vector.add(loc, session.clipboardTransform.relative).sub(size.mul(0.5).sub(1));
    const pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE)).floor();

    const selection = self.outlines.get(session)!;
    selection.set(0, pasteStart.floor());
    selection.set(1, pasteEnd);
    selection.draw();
    yield;
}
