import { Server } from "@notbeer-api";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { printLocation } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "up",
  permission: "worldedit.navigation.up",
  description: "commands.wedit:up.description",
  usage: [
    {
      name: "height",
      type: "int",
      range: [1, null] as [number, null]
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  const height = args.get("height") as number;

  let blockLoc = PlayerUtil.getBlockLocation(builder);
  const dimension = builder.dimension;
  for (let i = 0; i < height; i++, blockLoc = blockLoc.offset(0, 1, 0)) {
    if (dimension.getBlock(blockLoc.offset(0, 2, 0)).typeId != "minecraft:air") {
      break;
    }
  }

  Server.runCommand(`tp @s ${printLocation(blockLoc, false)}`, builder);
  Server.runCommand(`setblock ${printLocation(blockLoc.offset(0, -1, 0), false)} glass`, dimension);
  return RawText.translate("commands.wedit:up.explain");
});
