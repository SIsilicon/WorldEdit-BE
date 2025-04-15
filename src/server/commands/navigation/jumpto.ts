import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "jumpto",
    permission: "worldedit.navigation.jumpto.command",
    description: "commands.wedit:jumpto.description",
    aliases: ["j"],
};

registerCommand(registerInformation, function (session, builder) {
    const hit = PlayerUtil.traceForBlock(builder);
    if (hit) {
        builder.teleport(hit.offset(0.5, 0, 0.5), { dimension: builder.dimension });
        getCommandFunc("unstuck")(session, builder, new Map());
    } else {
        const teleportTo = Vector.add(builder.location, Vector.mul(builder.getViewDirection(), config.traceDistance));
        builder.runCommand(`tp ${teleportTo.x.toFixed(3)} ${teleportTo.y.toFixed(3)} ${teleportTo.z.toFixed(3)}`);
    }
    return RawText.translate("commands.wedit:jumpto.explain");
});
