import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { BlockLocation, Location } from "mojang-minecraft";

const registerInformation = {
    name: "ascend",
    permission: "worldedit.navigation.ascend",
    description: "commands.wedit:ascend.description"
};

registerCommand(registerInformation, function (session, builder, args) {
    let location = PlayerUtil.getBlockLocation(builder);
    const dimension = builder.dimension;

    for (let i = location.y + 3; i <= 319; i++) {
        let floor = new BlockLocation(location.x, i - 1, location.z);
        let legs = new BlockLocation(location.x, i, location.z);
        let head = new BlockLocation(location.x, i + 1, location.z);

        let invalid = false

        if (dimension.getBlock(floor).isEmpty) invalid = true
        if (!dimension.getBlock(legs).isEmpty) invalid = true
        if (!dimension.getBlock(head).isEmpty) invalid = true

        if (!invalid) {
            builder.teleport(new Location(location.x, legs.y, location.z), dimension, 0, 0);
            return RawText.translate("commands.wedit:ascend.explain");
        }
    }

    return RawText.translate("commands.wedit:ascend.obstructed");
});
