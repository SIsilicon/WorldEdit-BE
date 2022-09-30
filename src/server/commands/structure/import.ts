
import { PlayerUtil } from "@modules/player_util.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { RawText, Server, Vector } from "@notbeer-api";
import { EntityCreateEvent, Location, Player } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "import",
  permission: "worldedit.structure.import",
  description: "commands.wedit:import.description",
  usage: [
    {
      "name": "name",
      "type": "string"
    }
  ]
};

function readMetaData(name: string, player: Player) {
  if (!name.includes(":")) {
    name = "mystructure:" + name;
  }
  const blockLoc = PlayerUtil.getBlockLocation(player);

  let data: string;
  const onSpawn = (ev: EntityCreateEvent) => {
    if (ev.entity.typeId == "wedit:struct_meta") {
      data = ev.entity.nameTag;
      ev.entity.teleport(new Location(player.location.x, -1024, player.location.z), player.dimension, 0, 0);
      ev.entity.kill();
    }
  };

  Server.once("entityCreate", onSpawn);
  Server.structure.load(name, blockLoc, player.dimension);
  Server.off("entityCreate", onSpawn);
  return data;
}

registerCommand(registerInformation, function (session, builder, args) {
  let name: string = args.get("name");
  if (!name.includes(":")) {
    const ref = readMetaData("weditstructref_" + name, builder);
    if (ref) {
      name = ref;
    }
  }

  const [namespace, struct] = name.split(":") as [string, string];
  const metadata = JSON.parse(readMetaData(namespace + ":weditstructmeta_" + struct, builder));

  if (session.clipboard) {
    session.deleteRegion(session.clipboard);
  }

  session.clipboard = new RegionBuffer(false);
  session.clipboard.import(namespace + ":weditstructexport_" + struct, Vector.from(metadata.size).toBlock());
  session.clipboardTransform = {
    relative: Vector.from(metadata.relative),
    rotation: Vector.ZERO,
    flip: Vector.ONE,
  };

  return RawText.translate("commands.wedit:import.explain").with(args.get("name"));
});
