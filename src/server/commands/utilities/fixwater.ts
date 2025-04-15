import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation: CommandInfo = {
    name: "fixwater",
    permission: "worldedit.utility.fixwater",
    description: "commands.wedit:fixwater.description",
    usage: [{ name: "radius", type: "float" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const playerBlock = session.getPlacementPosition();
    let fixwaterStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        const block = dimension.getBlock(loc);
        if (block.typeId.match("water")) {
            fixwaterStart = loc;
            break;
        }
    }

    if (!fixwaterStart) throw "commands.wedit:fixWater.noWater";

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Fixing water...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(fixwaterStart, args.get("radius"), (ctx) => !!ctx.nextBlock.typeId.match("water"));

        if (!blocks.size) return blocks;

        const history = session.history;
        const record = history.record();
        try {
            yield* history.trackRegion(record, blocks);
            let i = 0;
            for (const loc of blocks) {
                dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)).setType("water");
                yield Jobs.setProgress(i++ / blocks.size);
            }
            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return blocks;
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.size}`);
});
