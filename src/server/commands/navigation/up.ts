import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { MinecraftBlockTypes } from "@minecraft/server";

const registerInformation = {
  name: "up",
  permission: "worldedit.navigation.up",
  description: "commands.wedit:up.description",
  usage: [
    {
      name: "height",
      type: "int",
      range: [0, null] as [number, null]
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  const height = args.get("height") as number;

  let blockLoc = PlayerUtil.getBlockLocation(builder);
  const dimension = builder.dimension;
  for (let i = 0; i < height; i++, blockLoc = blockLoc.offset(0, 1, 0)) {
    if (!dimension.getBlock(blockLoc.offset(0, 2, 0)).isAir()) {
      break;
    }
  }

  const block = dimension.getBlock(blockLoc.offset(0, -1, 0));
  builder.teleport(blockLoc.offset(0.5, 0, 0.5), { dimension });
  if (block.isAir()) block.setType(MinecraftBlockTypes.glass);
  return RawText.translate("commands.wedit:up.explain");
});
