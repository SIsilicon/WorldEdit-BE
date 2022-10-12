import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "jumpto",
  permission: "worldedit.navigation.jumpto.command",
  description: "commands.wedit:jumpto.description",
  aliases: ["j"]
};

registerCommand(registerInformation, function (session, builder) {
  const hit = PlayerUtil.traceForBlock(builder);
  if (!hit) {
    throw RawText.translate("commands.wedit:jumpto.none");
  }
  builder.teleport(hit, builder.dimension, builder.rotation.x, builder.rotation.y);
  getCommandFunc("unstuck")(session, builder, new Map());
  return RawText.translate("commands.wedit:jumpto.explain");
});
