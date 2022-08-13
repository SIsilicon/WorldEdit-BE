import { Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { WAND_ITEM } from "@config.js";

const registerInformation = {
  name: "kit",
  permission: "worldedit.kit",
  description: "commands.wedit:kit.description"
};

registerCommand(registerInformation, function (session, builder) {
  const items = [
    // HOTBAR ITEMS
    WAND_ITEM,
    "wedit:selection_fill",
    "wedit:pattern_picker",
    "wedit:copy_button",
    "wedit:cut_button",
    "wedit:paste_button",
    "wedit:undo_button",
    "wedit:redo_button",
    "wedit:config_button",
    // INVENTORY ITEMS
    "wedit:flip_button",
    "wedit:rotate_cw_button",
    "wedit:rotate_ccw_button",
    "wedit:mask_picker",
    "wedit:draw_line",
    "wedit:selection_wall",
    "wedit:selection_outline",
    "wedit:spawn_glass"
  ];

  for (const item of items) {
    if (Server.runCommand(`clear @s ${item} -1 0`, builder).error) {
      Server.runCommand(`give @s ${item}`, builder);
    }
  }
  session.bindTool("selection_wand", WAND_ITEM);

  return "commands.wedit:kit.explain";
});