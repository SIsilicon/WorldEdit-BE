import { PlayerUtil } from "@modules/player_util.js";
import { registerCommand } from "../register_commands.js";
import { setPos1 } from "./pos1.js";
import { CommandInfo } from "@notbeer-api";

const registerInformation: CommandInfo = {
    name: "hpos1",
    permission: "worldedit.selection.hpos",
    description: "commands.wedit:hpos1.description",
};

registerCommand(registerInformation, function (session, builder) {
    const hit = PlayerUtil.traceForBlock(builder);
    if (!hit) throw "commands.wedit:jumpto.none";
    return setPos1(session.selection, hit);
});
