import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { BlockLocation, Location, Player } from "mojang-minecraft";

const registerInformation = {
    name: "descend",
    permission: "worldedit.navigation.descend",
    description: "commands.wedit:descend.description",
    usage: [
        {
            name: "levels",
            type: "int",
            default: 1
        }
    ]
};

function descend(builder: Player) {
    let location = PlayerUtil.getBlockLocation(builder);
    const dimension = builder.dimension;

    for (let i = location.y - 3; i >= -64; i--) {
        let floor = new BlockLocation(location.x, i - 1, location.z);
        let legs = new BlockLocation(location.x, i, location.z);
        let head = new BlockLocation(location.x, i + 1, location.z);

        let invalid = false

        if (dimension.getBlock(floor).isEmpty) invalid = true
        if (!dimension.getBlock(legs).isEmpty) invalid = true
        if (!dimension.getBlock(head).isEmpty) invalid = true

        if (!invalid) {

            builder.teleport(new Location(location.x, legs.y, location.z), dimension, 0, 0);
            return RawText.translate("commands.wedit:thru.explain");
        }
    }
    return RawText.translate("commands.wedit:descend.obstructed")
}

registerCommand(registerInformation, function (session, builder, args) {
    let levels = args.get("levels") as number;

    for (let level = 0; level < levels; level++) {
        descend(builder);
    }

    return RawText.translate("commands.wedit:thru.explain");
});