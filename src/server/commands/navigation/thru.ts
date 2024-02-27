import { Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";
import { PlayerUtil } from "@modules/player_util.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation = {
    name: "thru",
    permission: "worldedit.navigation.thru.command",
    description: "commands.wedit:thru.description",
};

registerCommand(registerInformation, function (session, builder) {
    const dimension = builder.dimension;
    const limits = getWorldHeightLimits(dimension);
    const blockLoc = PlayerUtil.getBlockLocation(builder);

    const dir = new Cardinal().getDirection(builder);

    function isSpaceEmpty(loc: Vector) {
        return (loc.y < limits[0] || loc.y > limits[1] || dimension.getBlock(loc).isAir) && (loc.y + 1 < limits[0] || loc.y + 1 > limits[1] || dimension.getBlock(loc.offset(0, 1, 0)).isAir);
    }

    let testLoc = blockLoc.offset(dir.x, dir.y, dir.z);
    if (isSpaceEmpty(testLoc)) {
        throw "commands.wedit:thru.none";
    }

    let canGoThrough = false;
    for (let i = 0; i < (dir.y == 0 ? 3 : 4); i++) {
        testLoc = testLoc.offset(dir.x, dir.y, dir.z);
        if (isSpaceEmpty(testLoc)) {
            canGoThrough = true;
            break;
        }
    }

    if (canGoThrough) {
        builder.teleport(testLoc.offset(0.5, 0, 0.5), { dimension });
        return "commands.wedit:thru.explain";
    } else {
        throw "commands.wedit:thru.obstructed";
    }
});
