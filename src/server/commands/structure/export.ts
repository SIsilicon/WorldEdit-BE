
import { assertCanBuildWithin, assertCuboidSelection } from "@modules/assert.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionCenter, regionSize, Server, Vector } from "@notbeer-api";
import { BlockPermutation, Player, world } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
  name: "export",
  permission: "worldedit.structure.export",
  description: "commands.wedit:export.description",
  usage: [
    {
      flag: "e"
    },
    {
      flag: "a"
    },
    {
      name: "name",
      type: "string"
    }
  ]
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
    includeEntities: true
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
  let job: number;
  if (excludeAir) {
    Server.structure.save(tempStruct, ...range, dimension);
    job = Jobs.startJob(session, 1, range);
  }
  try {
    world.scoreboard.getObjective("wedit:exports") ?? world.scoreboard.addObjective("wedit:exports", "");
    if (Server.runCommand(`scoreboard players set ${struct_name} wedit:exports 1`).error) throw "Failed to save name to exports list";

    if (excludeAir) {
      Jobs.nextStep(job, "Masking air...");
      let count = 0;

      const fillMax = 32;
      const size = Vector.sub(range[1], range[0]).add(1);
      const structVoid = BlockPermutation.resolve("minecraft:structure_void");
      const air = BlockPermutation.resolve("minecraft:air");
      for (let z = 0; z < size.z; z += fillMax) {
        for (let y = 0; y < size.y; y += fillMax) {
          for (let x = 0; x < size.x; x += fillMax) {
            const subStart = Vector.add(range[0], [x, y, z]);
            const subEnd = Vector.min(
              new Vector(x, y, z).add(fillMax), size
            ).add(range[0]).sub(Vector.ONE);
            dimension.fillBlocks(subStart.floor(), subEnd.floor(), structVoid, { matchingBlock: air });
            const subSize = subEnd.sub(subStart).add(1);
            count += subSize.x * subSize.y * subSize.z;
            Jobs.setProgress(job, count / (size.x * size.y * size.z));
            yield;
          }
        }
      }
    }

    if(Server.structure.save(namespace + ":weditstructexport_" + struct, ...range, dimension, {
      saveToDisk: true,
      includeEntities: args.has("e")
    })) throw "Failed to save structure";

    const size = regionSize(...range);
    const playerPos = PlayerUtil.getBlockLocation(builder);
    const relative = Vector.sub(regionCenter(...range), playerPos);

    if(writeMetaData(namespace + ":weditstructmeta_" + struct,
      JSON.stringify({
        size: { x: size.x, y: size.y, z: size.z },
        relative: { x: relative.x, y: relative.y, z: relative.z },
        exporter: builder.name
      }),
      builder
    )) throw "Failed to save metadata";
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
    Jobs.finishJob(job);
  }

  let message = RawText.translate("commands.wedit:export.explain").with(args.get("name"));
  if (!users.includes(builder)) {
    message = message.append("text", "\n").append("translate", "commands.wedit:export.otherWorlds");
    users.push(builder);
  }
  return message;
});
