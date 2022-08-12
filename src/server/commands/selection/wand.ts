import { Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { WAND_ITEM } from "@config.js";
import { RawText } from "@notbeer-api";

const registerInformation = {
  name: "wand",
  permission: "worldedit.wand",
  description: "commands.wedit:wand.description"
};

registerCommand(registerInformation, function (session, builder) {
  Server.runCommand(`give @s ${WAND_ITEM}`, builder);
  session.bindTool("selection_wand", WAND_ITEM);
  return RawText.translate("commands.wedit:wand.explain");
});
