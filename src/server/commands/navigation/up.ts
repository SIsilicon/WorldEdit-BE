import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation = {
    name: "up",
    permission: "worldedit.navigation.up",
    description: "commands.wedit:up.description",
    usage: [
        {
            name: "height",
            type: "int",
            range: [0, null] as [number, null],
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    const height = args.get("height") as number;
    const dimension = builder.dimension;
    const limits = getWorldHeightLimits(dimension);
    const blockLoc = PlayerUtil.getBlockLocation(builder).offset(0, 2, 0);

    for (let i = 0; i < height; i++, blockLoc.y++) {
        if (blockLoc.y >= limits[0] && blockLoc.y <= limits[1] && !dimension.getBlock(blockLoc).isAir) {
            break;
        }
    }

    blockLoc.y -= 3;
    if (blockLoc.y >= limits[0] && blockLoc.y <= limits[1]) {
        const block = dimension.getBlock(blockLoc);
        if (block.isAir) block.setType("minecraft:glass");
    }

    builder.teleport(blockLoc.offset(0.5, 1, 0.5), { dimension });
    return RawText.translate("commands.wedit:up.explain");
});
