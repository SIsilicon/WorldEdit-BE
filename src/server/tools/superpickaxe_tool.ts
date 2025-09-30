import { Dimension, Player, Vector3 } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Server, Vector, regionIterateBlocks } from "@notbeer-api";
import { getWorldHeightLimits, locToString } from "server/util.js";
import config from "config.js";

class SuperPickaxeTool extends Tool {
    noDelay = true;
    permission = "worldedit.superpickaxe";

    *break(player: Player, session: PlayerSession, loc: Vector): Generator<void> {
        const dimension = player.dimension;
        const typeId = dimension.getBlock(loc).typeId;
        if (typeId == "minecraft:air") return;
        const { mode, range } = session.superPickaxe;
        if (mode == "single") {
            destroyBlock(dimension, loc, config.superPickaxeDrop);
            return;
        }
        const limits = getWorldHeightLimits(dimension);
        if (mode == "area") {
            const min = loc.sub(range);
            const max = loc.add(range);
            min.y = Math.max(min.y, limits[0]);
            max.y = Math.min(max.y, limits[1]);
            for (const block of regionIterateBlocks(min, max)) {
                if (dimension.getBlock(block).typeId == typeId) {
                    destroyBlock(dimension, block, config.superPickaxeManyDrop);
                }
                yield;
            }
            return;
        }
        const rangeSqr = range * range;
        const queue: Vector[] = [loc];
        const visited = new Set<string>();
        while (queue.length) {
            const block = queue.shift();
            const str = locToString(block);
            if (!visited.has(str) && loc.sub(block).lengthSqr <= rangeSqr && block.y >= limits[0] && block.y <= limits[1] && dimension.getBlock(block).typeId == typeId) {
                visited.add(str);
                destroyBlock(dimension, block, config.superPickaxeManyDrop);
                for (const offset of [
                    [0, 1, 0],
                    [0, -1, 0],
                    [1, 0, 0],
                    [-1, 0, 0],
                    [0, 0, 1],
                    [0, 0, -1],
                ] as [number, number, number][]) {
                    queue.push(block.add(offset));
                }
            }
            yield;
        }
    }

    hit = this.break;
}
Tools.register(
    SuperPickaxeTool,
    "superpickaxe",
    ["minecraft:diamond_pickaxe", "minecraft:golden_pickaxe", "minecraft:iron_pickaxe", "minecraft:netherite_pickaxe", "minecraft:stone_pickaxe", "minecraft:wooden_pickaxe"],
    function (player: Player, session: PlayerSession) {
        return session.superPickaxe.enabled;
    }
);

function destroyBlock(dimension: Dimension, loc: Vector3, drop: boolean) {
    if (drop) Server.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`, dimension);
    else dimension.getBlock(loc).setType("minecraft:air");
}
