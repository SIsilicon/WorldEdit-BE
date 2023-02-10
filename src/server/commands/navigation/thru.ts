import { Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";
import { PlayerUtil } from "@modules/player_util.js";

const registerInformation = {
  name: "thru",
  permission: "worldedit.navigation.thru.command",
  description: "commands.wedit:thru.description"
};

registerCommand(registerInformation, function (session, builder) {
  const dimension = builder.dimension;
  const blockLoc = PlayerUtil.getBlockLocation(builder);

  const dir = new Cardinal().getDirection(builder);

  function isSpaceEmpty(loc: Vector) {
    return dimension.getBlock(loc).typeId == "minecraft:air" && dimension.getBlock(loc.offset(0, 1, 0)).typeId == "minecraft:air";
  }

  let testLoc = blockLoc.offset(dir.x, dir.y, dir.z);
  if (isSpaceEmpty(testLoc)) {
    throw "commands.wedit:thru.none";
  }

  let canGoThrough = false;
  for (let i = 0; i < (dir.y == 0 ? 3 : 4); i++) {
    testLoc = testLoc.offset(dir.x, dir.y, dir.z);
    if (isSpaceEmpty(testLoc)) {
      canGoThrough = true;
      break;
    }
  }

  if (canGoThrough) {
    builder.teleport(testLoc, dimension, builder.getRotation().x, builder.getRotation().y);
    return "commands.wedit:thru.explain";
  } else {
    throw "commands.wedit:thru.obstructed";
  }
});
