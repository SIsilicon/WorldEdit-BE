import { NAV_WAND_ITEM } from "@config.js";
import { Server } from "@notbeer-api";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "navwand",
  permission: "worldedit.setwand",
  description: "commands.wedit:navwand.description"
};

registerCommand(registerInformation, function (session, builder) {
  Server.runCommand(`give @s ${NAV_WAND_ITEM}`, builder);
  session.bindTool("navigation_wand", NAV_WAND_ITEM);
  return RawText.translate("commands.wedit:navwand.explain");
});
