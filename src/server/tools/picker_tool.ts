import { RawText } from "@notbeer-api";
import { BlockPermutation, Vector3, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";

class PatternPickerTool extends Tool {
  useOn = function (self: Tool, player: Player, session: PlayerSession, loc: Vector3) {
    const dimension = player.dimension;
    let addedToPattern = false;
    const block = dimension.getBlock(loc).permutation.clone();
    let blockName = block.type.id;
    if (player.isSneaking) {
      session.globalPattern.addBlock(block);
      addedToPattern = true;
    } else {
      session.globalPattern.clear();
      session.globalPattern.addBlock(block);
    }

    blockName += printBlockProperties(block);
    if (blockName.startsWith("minecraft:")) {
      blockName = blockName.slice("minecraft:".length);
    }
    self.log(RawText.translate("worldedit.patternPicker." + (addedToPattern ? "add" : "set"))
      .append("text", blockName)
    );
  };
  use = function (self: Tool, player: Player, session: PlayerSession) {
    let addedToPattern = true;
    if (!player.isSneaking) {
      session.globalPattern.clear();
      addedToPattern = false;
    }
    session.globalPattern.addBlock(BlockPermutation.resolve("minecraft:air"));
    self.log(RawText.translate("worldedit.patternPicker." + (addedToPattern ? "add" : "set"))
      .append("text", "air")
    );
  };
}
Tools.register(PatternPickerTool, "pattern_picker", "wedit:pattern_picker");

class MaskPickerTool extends Tool {
  permission = "worldedit.global-mask";
  useOn = function (self: Tool, player: Player, session: PlayerSession, loc: Vector3) {
    const dimension = player.dimension;
    let addedToPattern = false;
    const block = dimension.getBlock(loc).permutation.clone();
    let blockName = block.type.id;
    if (player.isSneaking) {
      session.globalMask.addBlock(block);
      addedToPattern = true;
    } else {
      session.globalMask.clear();
      session.globalMask.addBlock(block);
    }

    blockName += printBlockProperties(block);
    if (blockName.startsWith("minecraft:")) {
      blockName = blockName.slice("minecraft:".length);
    }
    self.log(RawText.translate("worldedit.maskPicker." + (addedToPattern ? "add" : "set"))
      .append("text", blockName)
    );
  };
  use = function (self: Tool, player: Player, session: PlayerSession) {
    let addedToPattern = true;
    if (!player.isSneaking) {
      session.globalMask.clear();
      addedToPattern = false;
    }
    session.globalMask.addBlock(BlockPermutation.resolve("minecraft:air"));
    self.log(RawText.translate("worldedit.maskPicker." + (addedToPattern ? "add" : "set"))
      .append("text", "air")
    );
  };
}
Tools.register(MaskPickerTool, "mask_picker", "wedit:mask_picker");

function printBlockProperties(block: BlockPermutation) {
  let propString = "";
  const properties = block.getAllProperties();
  if (Object.keys(properties).length && block.type.id != "water" && block.type.id != "lava") {
    for (const prop in properties) {
      if (prop.startsWith("wall_connection_type") || prop.startsWith("liquid_depth")) {
        continue;
      }
      propString += `\n§o${prop}§r: ${properties[prop]}`;
    }
  }
  return propString;
}