import { RawText, Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation = {
  name: "blockid",
  aliases: ["id"],
  permission: "worldedit.blockid",
  description: "commands.wedit:blockid.description"
};

registerCommand(registerInformation, function (session, builder) {
  const block = builder.getBlockFromViewDirection({ includePassableBlocks: true })?.block;
  if (block) {
    let id = block.typeId;
    if (id.startsWith("minecraft:")) id = id.slice("minecraft:".length);
    const states = Object.entries(block.permutation.getAllStates());
    if (states.length) id += `[${states.map(([key, value]) => `${key}=${value}`).join(",")}]`;
    return id;
  } else {
    return "commands.wedit:blockid.noBlock";
  }
});