import { Vector3, Player, BlockStates } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { print, wrap } from "server/util.js";

class BlockCyclerTool extends Tool {
    private stateIndex = 0;

    permission = "worldedit.cycler";
    useOn = function (self: BlockCyclerTool, player: Player, session: PlayerSession, loc: Vector3) {
        if (player.isSneaking) {
            self.break(self, player, session, loc);
        } else {
            self.update(player, loc, true);
        }
    };

    break = function (self: BlockCyclerTool, player: Player, session: PlayerSession, loc: Vector3) {
        self.stateIndex++;
        self.update(player, loc, false);
    };

    update = function(player: Player, loc: Vector3, increment: boolean) {
        const block = player.dimension.getBlock(loc);
        let permutation = block.permutation;
        try {
            const states = Object.entries(permutation.getAllStates());

            // eslint-disable-next-line prefer-const
            let [currState, currValue] = states[this.stateIndex % states.length];
            const validValues = BlockStates.get(currState).validValues;
            const currValueIndex = validValues.indexOf(currValue);
            currValue = validValues[wrap(validValues.length, currValueIndex + (increment ? 1 : 0))];
            permutation = permutation.withState(currState, currValue);

            block.setPermutation(permutation);

            const texts = [];
            for (const [state, value] of states) {
                let stateText = "  " + state;
                let valueText = value;
                if (state == currState) {
                    if (typeof(value) == "boolean") {
                        valueText = currValue ? "§8false §ftrue" : "§ffalse §8true";
                    } else {
                        const prev = String(validValues[wrap(validValues.length, currValueIndex - (increment ? 0 : 1))]);
                        const next = String(validValues[wrap(validValues.length, currValueIndex + (increment ? 2 : 1))]);
                        valueText = [`§8...${prev.slice(-5)}`, "§f" + currValue, `§8${next.slice(0, 5)}...`].join(" ");
                    }
                    stateText = "> " + state;
                }
                texts.push(`${stateText}: ${valueText}§r`.padEnd(60));
            }
            print(texts.join("\n"), player, true);
        } catch { /* pass */ }
    };
}
Tools.register(BlockCyclerTool, "cycler_wand");
