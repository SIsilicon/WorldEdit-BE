import { Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { RawText } from "@notbeer-api";
import config from "config.js";

const registerInformation = {
  name: "wand",
  permission: "worldedit.wand",
  description: "commands.wedit:wand.description"
};

registerCommand(registerInformation, function (session, builder) {
  let item = config.wandItem;
  const boundItems = session.getTools("selection_wand");
  if (boundItems.length && !boundItems.includes(config.wandItem)) {
    item = boundItems[0];
  }
  Server.runCommand(`give @s ${item}`, builder);
  session.bindTool("selection_wand", item);
  return RawText.translate("commands.wedit:wand.explain");
});
