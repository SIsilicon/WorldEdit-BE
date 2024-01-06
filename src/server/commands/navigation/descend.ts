import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Player } from "@minecraft/server";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation = {
  name: "descend",
  permission: "worldedit.navigation.descend",
  description: "commands.wedit:descend.description",
  usage: [
    {
      name: "levels",
      type: "int",
      range: [1, null] as [number, null],
      default: 1
    }
  ]
};

function descend(builder: Player) {
  const dimension = builder.dimension;
  const limits = getWorldHeightLimits(dimension);
  const blockLoc = PlayerUtil.getBlockLocation(builder);

  for (blockLoc.y = Math.min(limits[1], blockLoc.y - 2);; blockLoc.y--) {
    if (blockLoc.y < limits[0]) return false;
    if (dimension.getBlock(blockLoc).isAir) continue;
    if (blockLoc.y + 1 <= limits[1] && !dimension.getBlock(blockLoc.offset(0, 1, 0)).isAir) continue;
    if (blockLoc.y + 2 <= limits[1] && !dimension.getBlock(blockLoc.offset(0, 2, 0)).isAir) continue;

    builder.teleport(blockLoc.offset(0.5, 1, 0.5), { dimension });
    return true;
  }
}

registerCommand(registerInformation, function (session, builder, args) {
  const levels = args.get("levels") as number;

  let count = 0;
  while (descend(builder)) {
    count++;
    if (count == levels) break;
  }

  if (count == 0) {
    throw RawText.translate("commands.wedit:descend.obstructed");
  }
  return RawText.translate("commands.wedit:thru.explain");
});
