import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation = {
    name: "ceil",
    permission: "worldedit.navigation.ceiling",
    description: "commands.wedit:ceiling.description",
    usage: [
        {
            name: "clearance",
            type: "int",
            range: [0, null] as [number, null],
            default: 0,
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    let clearance = args.get("clearance") as number;
    const dimension = builder.dimension;
    const limits = getWorldHeightLimits(dimension);
    const blockLoc = PlayerUtil.getBlockLocation(builder).offset(0, 2, 0);

    for (let i = 0; ; i++, blockLoc.y++) {
        if (blockLoc.y > limits[1]) {
            throw RawText.translate("commands.wedit:ascend.obstructed");
        }
        if (blockLoc.y >= limits[0] && !dimension.getBlock(blockLoc).isAir) {
            if (clearance > i) clearance = i;
            break;
        }
    }

    blockLoc.y -= clearance + 3;
    if (blockLoc.y >= limits[0] && blockLoc.y <= limits[1]) {
        const block = dimension.getBlock(blockLoc);
        if (block.isAir) block.setType("minecraft:glass");
    }

    builder.teleport(blockLoc.offset(0.5, 1, 0.5), { dimension });
    return RawText.translate("commands.wedit:up.explain");
});
