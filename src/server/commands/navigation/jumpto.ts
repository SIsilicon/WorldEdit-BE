import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation = {
    name: "jumpto",
    permission: "worldedit.navigation.jumpto.command",
    description: "commands.wedit:jumpto.description",
    aliases: ["j"],
};

registerCommand(registerInformation, function (session, builder) {
    const hit = PlayerUtil.traceForBlock(builder, config.traceDistance - 1);
    builder.teleport(hit.offset(0.5, 0, 0.5), { dimension: builder.dimension });
    getCommandFunc("unstuck")(session, builder, new Map());
    return RawText.translate("commands.wedit:jumpto.explain");
});
