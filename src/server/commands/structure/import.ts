
import { PlayerUtil } from "@modules/player_util.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { RawText, Server, Vector } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "import",
    permission: "worldedit.structure.import",
    description: "commands.wedit:import.description",
    usage: [
        {
            name: "name",
            type: "string"
        }
    ]
};

function readMetaData(name: string, player: Player) {
    if (!name.includes(":")) {
        name = "mystructure:" + name;
    }

    const dimension = player.dimension;
    let blockLoc = PlayerUtil.getBlockLocation(player);
    while (dimension.getEntitiesAtBlockLocation(blockLoc).some(e => e.typeId == "wedit:struct_meta")) {
        blockLoc = blockLoc.offset(1, 0, 0);
    }
    const entity = dimension.spawnEntity("wedit:struct_meta", blockLoc);
    entity.nameTag = "__wedit__placeholder__";

    Server.structure.load(name, blockLoc, player.dimension);
    let data: string;
    const imported = dimension.getEntitiesAtBlockLocation(blockLoc).find(
        entity => entity.typeId == "wedit:struct_meta" && entity.nameTag != "__wedit__placeholder__"
    );
    if (imported) {
        data = imported.nameTag;
        imported.triggerEvent("wedit:despawn");
    }
    entity.triggerEvent("wedit:despawn");
    return data;
}

export function importStructure(name: string, player: Player) {
    if (!name.includes(":")) {
        const ref = readMetaData("weditstructref_" + name, player);
        if (ref) {
            name = ref;
        }
    }

    const [namespace, struct] = name.split(":") as [string, string];
    let metadata;
    try {
        metadata = JSON.parse(readMetaData(namespace + ":weditstructmeta_" + struct, player));
    } catch {
        throw "commands.generic.wedit:commandFail";
    }

    const buffer = new RegionBuffer(false);
    buffer.import(namespace + ":weditstructexport_" + struct, Vector.from(metadata.size).floor());
    return { buffer, metadata };
}

registerCommand(registerInformation, function (session, builder, args) {
    const name: string = args.get("name");

    const { buffer, metadata } = importStructure(name, builder);

    if (session.clipboard) {
        session.deleteRegion(session.clipboard);
    }
    session.clipboard = buffer;
    session.clipboardTransform = {
        relative: Vector.from(metadata.relative),
        rotation: Vector.ZERO,
        flip: Vector.ONE,
    };


    return RawText.translate("commands.wedit:import.explain").with(args.get("name"));
});
