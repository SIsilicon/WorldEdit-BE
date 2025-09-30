/* eslint-disable @typescript-eslint/no-unused-vars */
import { Player } from "@minecraft/server";
import { everyCall, regionSize, Server, Vector } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { CuboidShape } from "server/shapes/cuboid.js";

const outlines = new WeakMap<PlayerSession, { lazyCall: (cb: () => any) => void }>();

interface PreviewPaste {
    tick: typeof previewPaste;
}

abstract class CommandButton extends Tool {
    abstract readonly command: string | string[];

    use(player: Player, session: PlayerSession) {
        if (typeof this.command == "string") {
            Server.command.callCommand(player, this.command);
        } else {
            Server.command.callCommand(player, this.command[0], this.command.slice(1));
        }
    }
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

    use(player: Player, session: PlayerSession) {
        Server.command.callCommand(player, this.command[0], this.command.slice(1) as string[]);
    }

    outlines = new WeakMap();
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

    use(player: Player, session: PlayerSession) {
        const args = ["90"];
        if (Server.player.isSneaking(player)) args.push("-o");
        Server.command.callCommand(player, "rotate", args);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(RotateCWTool, "rotate_cw", "wedit:rotate_cw_button");

class RotateCCWTool extends Tool implements PreviewPaste {
    permission = "worldedit.region.rotate";

    use(player: Player, session: PlayerSession) {
        const args = ["-90"];
        if (Server.player.isSneaking(player)) args.push("-o");
        Server.command.callCommand(player, "rotate", args);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(RotateCCWTool, "rotate_ccw", "wedit:rotate_ccw_button");

class FlipTool extends Tool implements PreviewPaste {
    permission = "worldedit.region.flip";

    use(player: Player, session: PlayerSession) {
        const args = [];
        if (Server.player.isSneaking(player)) args.push("-o");
        Server.command.callCommand(player, "flip", args);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tick = <any>previewPaste;
}
Tools.register(FlipTool, "flip", "wedit:flip_button");

class SpawnGlassTool extends Tool {
    use(player: Player) {
        Server.queueCommand("setblock ~~~ glass", player);
    }
}
Tools.register(SpawnGlassTool, "spawn_glass", "wedit:spawn_glass");

class ConfigTool extends Tool {
    use(player: Player, session: PlayerSession) {
        session.enterSettings();
    }
}
Tools.register(ConfigTool, "config", "wedit:config_button");

function* previewPaste(player: Player, session: PlayerSession): Generator<void> {
    if (!session.clipboard || !session.drawOutlines) return;

    if (!outlines.has(session)) outlines.set(session, { lazyCall: everyCall(8) });
    const [pasteStart, pasteEnd] = session.clipboard.getBounds(Vector.from(player.location).floor().add(0.5), session.clipboardTransform);
    const size = regionSize(pasteStart, pasteEnd);
    const shape = new CuboidShape(...size.toArray());
    outlines.get(session)!.lazyCall(() => shape.draw(player, pasteStart));
    yield;
}
