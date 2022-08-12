import { PlayerUtil } from "@modules/player_util.js";
import { registerCommand } from "../register_commands.js";
import { setPos2 } from "./pos2.js";

const registerInformation = {
  name: "hpos2",
  permission: "worldedit.selection.hpos",
  description: "commands.wedit:hpos2.description"
};

registerCommand(registerInformation, function (session, builder) {
  const hit = PlayerUtil.traceForBlock(builder);
  if (!hit) {
    throw "commands.wedit:jumpto.none";
  }
  return setPos2(session.selection, hit);
});
