import { Server } from "@notbeer-api";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation = {
  name: "navwand",
  permission: "worldedit.setwand",
  description: "commands.wedit:navwand.description"
};

registerCommand(registerInformation, function (session, builder) {
  Server.runCommand(`give @s ${config.navWandItem}`, builder);
  session.bindTool("navigation_wand", config.navWandItem);
  return RawText.translate("commands.wedit:navwand.explain");
});
