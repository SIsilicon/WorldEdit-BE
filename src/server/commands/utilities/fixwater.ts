import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, Vector } from "@notbeer-api";
import { BlockPermutation } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions, waterMatch } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation = {
    name: "fixwater",
    permission: "worldedit.utility.fixwater",
    description: "commands.wedit:fixwater.description",
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
    let fixwaterStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        const block = dimension.getBlock(loc);
        if (block.typeId.match(waterMatch)) {
            fixwaterStart = loc;
            break;
        }
    }

    if (!fixwaterStart) throw "commands.wedit:fixWater.noWater";

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Fixing water...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(fixwaterStart, args.get("radius"), (ctx) => {
            return !!ctx.nextBlock.typeId.match(waterMatch);
        });

        if (!blocks.length) return blocks;
        const [min, max] = regionBounds(blocks);

        const history = session.getHistory();
        const record = history.record();
        const water = BlockPermutation.resolve("minecraft:water");
        try {
            yield* history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)).setPermutation(water);
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
