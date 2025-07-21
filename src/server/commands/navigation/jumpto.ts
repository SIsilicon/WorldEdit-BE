import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText, sleep } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "jumpto",
    permission: "worldedit.navigation.jumpto.command",
    description: "commands.wedit:jumpto.description",
    aliases: ["j"],
};

registerCommand(registerInformation, function* (session, builder) {
    const hit = PlayerUtil.traceForBlock(builder, config.traceDistance);
    builder.runCommand(`tp ${hit.x} ${hit.y} ${hit.z}`);
    while (!builder.dimension.getBlock(hit)) yield sleep(1);
    getCommandFunc("unstuck")(session, builder, new Map());

    return RawText.translate("commands.wedit:jumpto.explain");
});
