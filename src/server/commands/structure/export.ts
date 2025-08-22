import { assertCuboidSelection } from "@modules/assert.js";
import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText, regionSize, Server, Vector } from "@notbeer-api";
import { Player, StructureSaveMode, world } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { RegionBuffer, RegionSaveOptions } from "@modules/region_buffer.js";

const registerInformation: CommandInfo = {
    name: "export",
    permission: "worldedit.structure.export",
    description: "commands.wedit:export.description",
    usage: [{ flag: "e" }, { flag: "a" }, { name: "name", type: "string" }],
};

function writeMetaData(name: string, data: string, player: Player) {
    if (!name.includes(":")) name = "mystructure:" + name;

    const dimension = player.dimension;
    let blockLoc = PlayerUtil.getBlockLocation(player);
    while (dimension.getEntitiesAtBlockLocation(blockLoc).length) blockLoc = blockLoc.offset(0, 1, 0);
    const entity = dimension.spawnEntity(<any>"wedit:struct_meta", blockLoc);
    entity.nameTag = data;

    world.structureManager.delete(name);
    const structure = world.structureManager.createFromWorld(name, dimension, blockLoc, blockLoc, {
        includeBlocks: false,
        includeEntities: true,
        saveMode: StructureSaveMode.World,
    });
    entity.remove();
    return structure;
}

const users: Player[] = [];
registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    const range = session.selection.getRange();
    const dimension = builder.dimension;
    const excludeAir = args.has("a");
    const includeEntities = args.has("e");

    let struct_name: string = args.get("name");
    if (!struct_name.includes(":")) struct_name = "wedit:" + struct_name;
    const [namespace, struct] = struct_name.split(":") as [string, string];

    yield* Jobs.run(session, 1, function* () {
        try {
            world.scoreboard.getObjective("wedit:exports") ?? world.scoreboard.addObjective("wedit:exports", "");
            if (Server.runCommand(`scoreboard players set ${struct_name} wedit:exports 1`).error) throw "Failed to save name to exports list";

            const createOptions: RegionSaveOptions = { saveAs: namespace + ":weditstructexport_" + struct, includeEntities };
            if (excludeAir) createOptions.modifier = (block) => !block.isAir;

            if (!(yield* RegionBuffer.createFromWorld(...range, dimension, createOptions))) throw "Failed to save structure";

            const size = regionSize(...range);
            const playerPos = PlayerUtil.getBlockLocation(builder).add(0.5);
            const relative = Vector.sub(range[0], playerPos);
            const data = {
                size: { x: size.x, y: size.y, z: size.z },
                relative: { x: relative.x, y: relative.y, z: relative.z },
                exporter: builder.name,
            };

            if (!writeMetaData(namespace + ":weditstructmeta_" + struct, JSON.stringify(data), builder)) throw "Failed to save metadata";
            if (!writeMetaData("weditstructref_" + struct, struct_name, builder)) throw "Failed to save reference data";
        } catch (e) {
            const [namespace, name] = struct_name.split(":") as [string, string];
            world.structureManager.delete(namespace + ":weditstructexport_" + name);
            world.structureManager.delete(namespace + ":weditstructmeta_" + name);
            world.structureManager.delete("weditstructref_" + name);
            Server.runCommand(`scoreboard players reset ${struct_name} wedit:exports`);
            console.error(e);
            throw "commands.generic.wedit:commandFail";
        }
    });

    let message = RawText.translate("commands.wedit:export.explain").with(args.get("name"));
    if (!users.includes(builder)) {
        message = message.append("text", "\n").append("translate", "commands.wedit:export.otherWorlds");
        users.push(builder);
    }
    return message;
});
