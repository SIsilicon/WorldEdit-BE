
import { assertCanBuildWithin, assertCuboidSelection } from "@modules/assert.js";
import { PlayerUtil } from "@modules/player_util.js";
import { contentLog, RawText, regionCenter, regionSize, Server, Vector } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "export",
  permission: "worldedit.structure.export",
  description: "commands.wedit:export.description",
  usage: [
    {
      flag: "e"
    },
    {
      name: "name",
      type: "string"
    }
  ]
};

function writeMetaData(name: string, data: string, player: Player) {
  if (!name.includes(":")) {
    name = "mystructure:" + name;
  }

  const dimension = player.dimension;
  let blockLoc = PlayerUtil.getBlockLocation(player);
  blockLoc.y = 2048;
  while (dimension.getEntitiesAtBlockLocation(blockLoc).length) {
    blockLoc = blockLoc.offset(0, 1, 0);
  }
  const entity = dimension.spawnEntity("wedit:struct_meta", blockLoc);
  entity.nameTag = data;

  return Server.structure.save(name, blockLoc, blockLoc, dimension, {
    saveToDisk: true,
    includeBlocks: false,
    includeEntities: true
  }).then(err => {
    entity.triggerEvent("wedit:despawn");
    return err;
  });
}

const users: Player[] = [];
registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const range = session.selection.getRange();
  const dimension = builder.dimension;
  assertCanBuildWithin(builder, ...range);

  let struct_name: string = args.get("name");
  if (!struct_name.includes(":")) {
    struct_name = "wedit:" + struct_name;
  }
  const [namespace, struct] = struct_name.split(":") as [string, string];
  const promises: Promise<boolean>[] = [];

  Server.flushCommands();
  Server.runCommand("scoreboard objectives add wedit:exports dummy");
  promises.push(Server.runCommand(`scoreboard players set ${struct_name} wedit:exports 1`).then(result => result.error));

  promises.push(Server.structure.save(namespace + ":weditstructexport_" + struct, ...range, dimension, {
    saveToDisk: true,
    includeEntities: args.has("e")
  }));

  const size = regionSize(...range);
  const playerPos = PlayerUtil.getBlockLocation(builder);
  const relative = Vector.sub(regionCenter(...range), playerPos);

  promises.push(writeMetaData(namespace + ":weditstructmeta_" + struct,
    JSON.stringify({
      size: { x: size.x, y: size.y, z: size.z },
      relative: { x: relative.x, y: relative.y, z: relative.z },
      exporter: builder.name
    }),
    builder
  ));
  promises.push(writeMetaData("weditstructref_" + struct, struct_name, builder));

  const errors = (yield Promise.all(promises)) as boolean[];
  if (errors.some(v => v)) {
    const [namespace, name] = struct_name.split(":") as [string, string];
    Server.structure.delete(namespace + ":weditstructexport_" + name);
    Server.structure.delete(namespace + ":weditstructmeta_" + name);
    Server.structure.delete("weditstructref_" + name);
    Server.runCommand(`scoreboard players reset ${struct_name} wedit:exports`);
    contentLog.debug("error here!");
    throw "commands.generic.wedit:commandFail";
  }

  let message = RawText.translate("commands.wedit:export.explain").with(args.get("name"));
  if (!users.includes(builder)) {
    message = message.append("text", "\n").append("translate", "commands.wedit:export.otherWorlds");
    users.push(builder);
  }
  return message;
});
