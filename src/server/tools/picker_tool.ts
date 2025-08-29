import { RawText, Server } from "@notbeer-api";
import { Vector3, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { print } from "server/util.js";

class PatternPickerTool extends Tool {
    useOn = function (self: Tool, player: Player, session: PlayerSession, loc: Vector3) {
        const dimension = player.dimension;
        let addedToPattern = false;
        const block = dimension.getBlock(loc);
        if (Server.player.isSneaking(player)) {
            session.globalPattern.addBlock(block.permutation);
            addedToPattern = true;
        } else {
            session.globalPattern.clear();
            session.globalPattern.addBlock(block.permutation);
        }
        print(RawText.translate("worldedit.patternPicker." + (addedToPattern ? "add" : "set")).append("translate", block.localizationKey), player, true);
    };
    use = function (self: Tool, player: Player, session: PlayerSession) {
        let addedToPattern = true;
        if (!Server.player.isSneaking(player)) {
            session.globalPattern.clear();
            addedToPattern = false;
        }
        const block = player.dimension.getBlock(player.getHeadLocation());
        session.globalPattern.addBlock(block.permutation);
        print(RawText.translate("worldedit.patternPicker." + (addedToPattern ? "add" : "set")).append("translate", block.localizationKey), player, true);
    };
}
Tools.register(PatternPickerTool, "pattern_picker", "wedit:pattern_picker");

class MaskPickerTool extends Tool {
    permission = "worldedit.global-mask";
    useOn = function (self: Tool, player: Player, session: PlayerSession, loc: Vector3) {
        const dimension = player.dimension;
        let addedToPattern = false;
        const block = dimension.getBlock(loc);
        if (Server.player.isSneaking(player)) {
            session.globalMask.addBlock(block.permutation);
            addedToPattern = true;
        } else {
            session.globalMask.clear();
            session.globalMask.addBlock(block.permutation);
        }
        print(RawText.translate("worldedit.maskPicker." + (addedToPattern ? "add" : "set")).append("translate", block.localizationKey), player, true);
    };
    use = function (self: Tool, player: Player, session: PlayerSession) {
        let addedToPattern = true;
        if (!Server.player.isSneaking(player)) {
            session.globalMask.clear();
            addedToPattern = false;
        }
        const block = player.dimension.getBlock(player.getHeadLocation());
        session.globalMask.addBlock(block.permutation);
        print(RawText.translate("worldedit.maskPicker." + (addedToPattern ? "add" : "set")).append("translate", block.localizationKey), player, true);
    };
}
Tools.register(MaskPickerTool, "mask_picker", "wedit:mask_picker");
