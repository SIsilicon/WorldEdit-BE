import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Player } from "@minecraft/server";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation: CommandInfo = {
    name: "ascend",
    permission: "worldedit.navigation.ascend",
    description: "commands.wedit:ascend.description",
    usage: [{ name: "levels", type: "int", range: [1, null], default: 1 }],
};

function ascend(builder: Player) {
    const dimension = builder.dimension;
    const limits = getWorldHeightLimits(dimension);
    const blockLoc = PlayerUtil.getBlockLocation(builder);

    for (blockLoc.y = Math.max(limits[0], blockLoc.y); ; blockLoc.y++) {
        if (blockLoc.y > limits[1]) return false;
        if (dimension.getBlock(blockLoc).isAir) continue;
        if (blockLoc.y + 1 <= limits[1] && !dimension.getBlock(blockLoc.offset(0, 1, 0)).isAir) continue;
        if (blockLoc.y + 2 <= limits[1] && !dimension.getBlock(blockLoc.offset(0, 2, 0)).isAir) continue;

        builder.teleport(blockLoc.offset(0.5, 1, 0.5), { dimension });
        return true;
    }
}

registerCommand(registerInformation, function (session, builder, args) {
    const levels = args.get("levels") as number;

    let count = 0;
    while (ascend(builder)) {
        count++;
        if (count == levels) break;
    }

    if (count == 0) {
        throw RawText.translate("commands.wedit:ascend.obstructed");
    }
    return RawText.translate("commands.wedit:thru.explain");
});
