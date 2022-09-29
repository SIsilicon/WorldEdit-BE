import { Server } from "@notbeer-api";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { printLocation } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "unstuck",
  permission: "worldedit.navigation.unstuck",
  description: "commands.wedit:unstuck.description",
  aliases: ["!"]
};

registerCommand(registerInformation, function (session, builder) {
  const blockLoc = PlayerUtil.getBlockLocation(builder);
  const dimension = builder.dimension;
  do {
    if (dimension.getBlock(blockLoc).id == "minecraft:air" &&
        dimension.getBlock(blockLoc.offset(0, 1, 0)).id == "minecraft:air") {
      break;
    }
  }
  // eslint-disable-next-line no-cond-assign
  while (blockLoc.y += 1);

  Server.runCommand(`tp @s ${printLocation(blockLoc, false)}`, builder);
  return RawText.translate("commands.wedit:unstuck.explain");
});
