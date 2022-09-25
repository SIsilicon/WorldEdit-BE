
import { assertCanBuildWithin, assertCuboidSelection } from "@modules/assert.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionCenter, regionSize, Server, setTickTimeout, Vector} from "@notbeer-api";
import { Location, Player } from "mojang-minecraft";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "export",
  permission: "worldedit.structure.export",
  description: "commands.wedit:export.description",
  usage: [
    {
      "flag": "e"
    },
    {
      "name": "name",
      "type": "string"
    }
  ]
};

function writeMetaData(name: string, data: string, player: Player) {
  if (!name.includes(":")) {
    name = "mystructure:" + name;
  }

  const dimension = player.dimension;
  const blockLoc = PlayerUtil.getBlockLocation(player);
  const entity = dimension.spawnEntity("wedit:struct_meta", blockLoc);
  entity.nameTag = data;

  const err = Server.structure.save(name, blockLoc, blockLoc, dimension, {
    saveToDisk: true,
    includeBlocks: false,
    includeEntities: true
  });
  entity.teleport(new Location(player.location.x, -1024, player.location.z), dimension, 0, 0);
  setTickTimeout(() => entity.kill());

  return err;
}

function processError(struct_name: string, err: boolean) {
  if (err) {
    const [namespace, name] = struct_name.split(":") as [string, string];
    Server.structure.delete(namespace + ":weditstructexport_" + name);
    Server.structure.delete(namespace + ":weditstructmeta_" + name);
    Server.structure.delete("weditstructref_" + name);
    Server.runCommand(`scoreboard players reset ${struct_name} wedit:exports`);
    throw "commands.generic.wedit:commandFail";
  }
}

// TODO: Modify app for renamed structures

const users: Player[] = [];
registerCommand(registerInformation, function (session, builder, args) {
  assertCuboidSelection(session);

  const range = session.selection.getRange();
  const dimension = builder.dimension;
  assertCanBuildWithin(builder, ...range);

  let name: string = args.get("name");
  if (!name.includes(":")) {
    name = "wedit:" + name;
  }
  const [namespace, struct] = name.split(":") as [string, string];

  Server.runCommand("scoreboard objectives add wedit:exports dummy");
  let error = Server.runCommand(`scoreboard players set ${name} wedit:exports 1`).error;
  processError(name, error);

  error ||= Server.structure.save(namespace + ":weditstructexport_" + struct, ...range, dimension, {
    saveToDisk: true,
    includeEntities: args.has("e")
  });
  processError(name, error);

  const size = regionSize(...range);
  const playerPos = PlayerUtil.getBlockLocation(builder);
  const relative = Vector.sub(regionCenter(...range), playerPos);

  error ||= writeMetaData(namespace + ":weditstructmeta_" + struct,
    JSON.stringify({
      size: { x: size.x, y: size.y, z: size.z },
      relative: { x: relative.x, y: relative.y, z: relative.z },
      exporter: builder.name
    }),
    builder
  );
  processError(name, error);

  error ||= writeMetaData("weditstructref_" + struct, name, builder);
  processError(name, error);

  let message = RawText.translate("commands.wedit:export.explain").with(args.get("name"));
  if (!users.includes(builder)) {
    message = message.append("text", "\n").append("translate", "commands.wedit:export.otherWorlds");
    users.push(builder);
  }
  return message;
});
