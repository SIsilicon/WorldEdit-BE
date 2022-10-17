import { RawText } from "@notbeer-api";
import { MinecraftBlockTypes, BlockPermutation, BlockLocation, Player, BoolBlockProperty, StringBlockProperty, IntBlockProperty } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";

class PatternPickerTool extends Tool {
  useOn = function (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
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
    session.globalPattern.addBlock(MinecraftBlockTypes.air.createDefaultBlockPermutation());
    self.log(RawText.translate("worldedit.patternPicker." + (addedToPattern ? "add" : "set"))
      .append("text", "air")
    );
  };
}
Tools.register(PatternPickerTool, "pattern_picker", "wedit:pattern_picker");

class MaskPickerTool extends Tool {
  permission = "worldedit.global-mask";
  useOn = function (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
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
    session.globalMask.addBlock(MinecraftBlockTypes.air.createDefaultBlockPermutation());
    self.log(RawText.translate("worldedit.maskPicker." + (addedToPattern ? "add" : "set"))
      .append("text", "air")
    );
  };
}
Tools.register(MaskPickerTool, "mask_picker", "wedit:mask_picker");

function printBlockProperties(block: BlockPermutation) {
  let propString = "";
  const properties = block.getAllProperties();
  if (properties.length && block.type.id != "water" && block.type.id != "lava") {
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      if (prop.name.startsWith("wall_connection_type") || prop.name.startsWith("liquid_depth")) {
        continue;
      }
      propString += `\n§o${prop.name}§r: ${(prop as BoolBlockProperty|StringBlockProperty|IntBlockProperty).value}`;
    }
  }
  return propString;
}