import { assertCanBuildWithin, assertCuboidSelection } from "@modules/assert.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionCenter, regionIterateChunks, regionSize, Server, sleep, Vector } from "@notbeer-api";
import { BlockPermutation, BlockVolume, Player, world } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
    name: "export",
    permission: "worldedit.structure.export",
    description: "commands.wedit:export.description",
    usage: [
        {
            flag: "e",
        },
        {
            flag: "a",
        },
        {
            name: "name",
            type: "string",
        },
    ],
};

let tempID = 0;

function writeMetaData(name: string, data: string, player: Player) {
    if (!name.includes(":")) {
        name = "mystructure:" + name;
    }

    const dimension = player.dimension;
    let blockLoc = PlayerUtil.getBlockLocation(player);
    while (dimension.getEntitiesAtBlockLocation(blockLoc).length) {
        blockLoc = blockLoc.offset(0, 1, 0);
    }
    const entity = dimension.spawnEntity("wedit:struct_meta", blockLoc);
    entity.nameTag = data;

    const error = Server.structure.save(name, blockLoc, blockLoc, dimension, {
        saveToDisk: true,
        includeBlocks: false,
        includeEntities: true,
    });
    entity.triggerEvent("wedit:despawn");
    return error;
}

const users: Player[] = [];
registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    const range = session.selection.getRange();
    const dimension = builder.dimension;
    const excludeAir = args.has("a");
    assertCanBuildWithin(builder, ...range);

    let struct_name: string = args.get("name");
    if (!struct_name.includes(":")) {
        struct_name = "wedit:" + struct_name;
    }
    const [namespace, struct] = struct_name.split(":") as [string, string];

    const tempStruct = `wedit:temp_export${tempID++}`;
    yield* Jobs.run(session, 1, function* () {
        if (excludeAir) Server.structure.save(tempStruct, ...range, dimension);

        try {
            world.scoreboard.getObjective("wedit:exports") ?? world.scoreboard.addObjective("wedit:exports", "");
            if (Server.runCommand(`scoreboard players set ${struct_name} wedit:exports 1`).error) throw "Failed to save name to exports list";

            if (excludeAir) {
                yield Jobs.nextStep("Masking air...");
                let count = 0;
                const size = Vector.sub(range[1], range[0]).add(1);
                const structVoid = BlockPermutation.resolve("minecraft:structure_void");
                const air = BlockPermutation.resolve("minecraft:air");
                for (const [subStart, subEnd] of regionIterateChunks(...range)) {
                    while (!Jobs.loadBlock(regionCenter(subStart, subEnd))) yield sleep(1);
                    dimension.fillBlocks(new BlockVolume(subStart.floor(), subEnd.floor()), structVoid, { blockFilter: { includeTypes: ["air"] } });
                    const subSize = subEnd.sub(subStart).add(1);
                    count += subSize.x * subSize.y * subSize.z;
                    yield Jobs.setProgress(count / (size.x * size.y * size.z));
                }
            }

            const jobCtx = Jobs.getContext();
            if (
                yield Server.structure.saveWhileLoadingChunks(
                    namespace + ":weditstructexport_" + struct,
                    ...range,
                    dimension,
                    {
                        saveToDisk: true,
                        includeEntities: args.has("e"),
                    },
                    (min, max) => {
                        if (Jobs.isContextValid(jobCtx)) {
                            Jobs.loadBlock(regionCenter(min, max));
                            return false;
                        }
                        return true;
                    }
                )
            )
                throw "Failed to save structure";

            const size = regionSize(...range);
            const playerPos = PlayerUtil.getBlockLocation(builder);
            const relative = Vector.sub(regionCenter(...range), playerPos);

            if (
                writeMetaData(
                    namespace + ":weditstructmeta_" + struct,
                    JSON.stringify({
                        size: { x: size.x, y: size.y, z: size.z },
                        relative: { x: relative.x, y: relative.y, z: relative.z },
                        exporter: builder.name,
                    }),
                    builder
                )
            )
                throw "Failed to save metadata";
            if (writeMetaData("weditstructref_" + struct, struct_name, builder)) throw "Failed to save reference data";
        } catch (e) {
            const [namespace, name] = struct_name.split(":") as [string, string];
            Server.structure.delete(namespace + ":weditstructexport_" + name);
            Server.structure.delete(namespace + ":weditstructmeta_" + name);
            Server.structure.delete("weditstructref_" + name);
            Server.runCommand(`scoreboard players reset ${struct_name} wedit:exports`);
            console.error(e);
            throw "commands.generic.wedit:commandFail";
        } finally {
            if (excludeAir) {
                Server.structure.load(tempStruct, range[0], dimension);
                Server.structure.delete(tempStruct);
            }
        }
    });

    let message = RawText.translate("commands.wedit:export.explain").with(args.get("name"));
    if (!users.includes(builder)) {
        message = message.append("text", "\n").append("translate", "commands.wedit:export.otherWorlds");
        users.push(builder);
    }
    return message;
});
