import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation: CommandInfo = {
    name: "unstuck",
    permission: "worldedit.navigation.unstuck",
    description: "commands.wedit:unstuck.description",
    aliases: ["!"],
};

registerCommand(registerInformation, function (session, builder) {
    const dimension = builder.dimension;
    const limits = getWorldHeightLimits(dimension);
    const blockLoc = PlayerUtil.getBlockLocation(builder);

    for (blockLoc.y = Math.max(limits[0], blockLoc.y); ; blockLoc.y++) {
        if (blockLoc.y <= limits[1] && !dimension.getBlock(blockLoc).isAir) continue;
        if (blockLoc.y + 1 <= limits[1] && !dimension.getBlock(blockLoc.offset(0, 1, 0)).isAir) continue;

        builder.teleport(blockLoc.offset(0.5, 0, 0.5), { dimension });
        return RawText.translate("commands.wedit:unstuck.explain");
    }
});
