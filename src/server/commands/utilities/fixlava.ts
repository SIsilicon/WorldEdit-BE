import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, sleep, Vector } from "@notbeer-api";
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
            type: "float"
        }
    ]
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

    if (!fixlavaStart) {
        throw "commands.wedit:fixlava.noLava";
    }

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Fixing lava...");
        // Stop filling at unloaded chunks
        const blocks = yield* floodFill(fixlavaStart, args.get("radius"), (ctx, dir) => {
            const block = dimension.getBlock(ctx.worldPos.offset(dir.x, dir.y, dir.z));
            if (!block?.typeId.match(lavaMatch)) return false;
            return true;
        });

        if (!blocks.length) return blocks;
        const [min, max] = regionBounds(blocks);

        const history = session.getHistory();
        const record = history.record();
        const lava = BlockPermutation.resolve("minecraft:lava");
        try {
            yield history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                let block = dimension.getBlock(loc);
                while (!(block || (block = Jobs.loadBlock(loc)))) yield sleep(1);
                block.setPermutation(lava);
                yield Jobs.setProgress(i++ / blocks.length);
            }
            yield history.addRedoStructure(record, min, max, blocks);
            history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return blocks;
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.length}`);
});
