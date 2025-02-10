import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, Vector } from "@notbeer-api";
import { BlockPermutation } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions, lavaMatch } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation = {
    name: "fixlava",
    permission: "worldedit.utility.fixlava",
    description: "commands.wedit:fixlava.description",
    usage: [
        {
            name: "radius",
            type: "float",
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const playerBlock = session.getPlacementPosition();
    let fixlavaStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        const block = dimension.getBlock(loc);
        if (block.typeId.match(lavaMatch)) {
            fixlavaStart = loc;
            break;
        }
    }

    if (!fixlavaStart) throw "commands.wedit:fixlava.noLava";

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Fixing lava...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(fixlavaStart, args.get("radius"), (ctx) => {
            return !!ctx.nextBlock.typeId.match(lavaMatch);
        });

        if (!blocks.length) return blocks;
        const [min, max] = regionBounds(blocks);

        const history = session.getHistory();
        const record = history.record();
        const lava = BlockPermutation.resolve("minecraft:lava");
        try {
            yield* history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)).setPermutation(lava);
                yield Jobs.setProgress(i++ / blocks.length);
            }
            yield* history.addRedoStructure(record, min, max, blocks);
            history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return blocks;
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.length}`);
});
