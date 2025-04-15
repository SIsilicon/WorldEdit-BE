import { PlayerUtil } from "@modules/player_util.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { Player, world } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "import",
    permission: "worldedit.structure.import",
    description: "commands.wedit:import.description",
    usage: [{ name: "name", type: "string" }],
};

function readMetaData(name: string, player: Player) {
    if (!name.includes(":")) name = "mystructure:" + name;

    const dimension = player.dimension;
    let blockLoc = PlayerUtil.getBlockLocation(player);
    while (dimension.getEntitiesAtBlockLocation(blockLoc).some((e) => e.typeId == "wedit:struct_meta")) blockLoc = blockLoc.offset(1, 0, 0);
    const entity = dimension.spawnEntity(<any>"wedit:struct_meta", blockLoc);
    entity.nameTag = "__placeholder__";

    world.structureManager.place(name, player.dimension, blockLoc);
    let data: string;
    const imported = dimension.getEntitiesAtBlockLocation(blockLoc).find((entity) => entity.typeId == "wedit:struct_meta" && entity.nameTag != "__placeholder__");
    if (imported) {
        data = imported.nameTag;
        imported.remove();
    }
    entity.remove();
    return data;
}

export function importStructure(name: string, player: Player) {
    if (!name.includes(":")) {
        const ref = readMetaData("weditstructref_" + name, player);
        if (ref) name = ref;
    }

    const [namespace, struct] = name.split(":") as [string, string];
    let metadata;
    try {
        metadata = JSON.parse(readMetaData(namespace + ":weditstructmeta_" + struct, player));
    } catch {
        throw "commands.generic.wedit:commandFail";
    }

    const buffer = RegionBuffer.get(namespace + ":weditstructexport_" + struct);
    return { buffer, metadata };
}

registerCommand(registerInformation, function (session, builder, args) {
    const name: string = args.get("name");
    const { buffer, metadata } = importStructure(name, builder);

    if (session.clipboard) session.deleteRegion(session.clipboard);
    session.clipboard = buffer;
    session.clipboardTransform = {
        offset: Vector.from(metadata.relative),
        rotation: Vector.ZERO,
        scale: Vector.ONE,
    };

    return RawText.translate("commands.wedit:import.explain").with(args.get("name"));
});
