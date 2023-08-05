import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
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
    if (dimension.getBlock(blockLoc).isAir &&
        dimension.getBlock(blockLoc.offset(0, 1, 0)).isAir) {
      break;
    }
  }
  // eslint-disable-next-line no-cond-assign
  while (blockLoc.y += 1);

  builder.teleport(blockLoc.offset(0.5, 0, 0.5), { dimension });
  return RawText.translate("commands.wedit:unstuck.explain");
});
