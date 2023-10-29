import { Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Server, Vector } from "@notbeer-api";

class SuperPickaxeTool extends Tool {
  noDelay = true;
  permission = "worldedit.superpickaxe";

  break = function () { /* pass */ };

  hit = function (self: SuperPickaxeTool, player: Player, session: PlayerSession, loc: Vector) {
    Server.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`, player);
  };

  constructor() {
    super();
  }
}
Tools.register(SuperPickaxeTool, "superpickaxe", [
  "minecraft:diamond_pickaxe",
  "minecraft:golden_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:netherite_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:wooden_pickaxe",
], function (player: Player, session: PlayerSession) {
  return session.superPickaxe.enabled;
});
