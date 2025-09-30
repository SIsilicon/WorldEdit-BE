import { Vector3, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Pattern } from "@modules/pattern.js";
import { Server } from "@notbeer-api";

class BlockReplacerTool extends Tool {
    public pattern: Pattern;

    noDelay = true;
    permission = "worldedit.repl";
    useOn(player: Player, session: PlayerSession, loc: Vector3) {
        if (Server.player.isSneaking(player)) {
            this.break(player, session, loc);
        } else {
            this.pattern.setBlock(player.dimension.getBlock(loc));
        }
    }

    break(player: Player, session: PlayerSession, loc: Vector3) {
        const pattern = new Pattern();
        pattern.addBlock(player.dimension.getBlock(loc).permutation);
        session.setToolProperty(null, "pattern", pattern);
    }

    constructor(pattern: Pattern) {
        super();
        this.pattern = pattern;
    }

    toJSON() {
        return {
            toolType: this.type,
            pattern: this.pattern,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        return [new Pattern(json.pattern)];
    }
}
Tools.register(BlockReplacerTool, "replacer_wand");
