import { Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { RawText } from "@notbeer-api";
import config from "@config.js";

const registerInformation = {
  name: "wand",
  permission: "worldedit.wand",
  description: "commands.wedit:wand.description"
};

registerCommand(registerInformation, function (session, builder) {
  Server.runCommand(`give @s ${config.wandItem}`, builder);
  session.bindTool("selection_wand", config.wandItem);
  return RawText.translate("commands.wedit:wand.explain");
});
