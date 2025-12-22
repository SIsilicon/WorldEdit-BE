import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation: CommandInfo = {
    name: "fixlava",
    permission: "worldedit.utility.fixlava",
    description: "commands.wedit:fixlava.description",
    usage: [{ name: "radius", type: "float" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const playerBlock = session.getPlacementPosition();
    let fixlavaStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        const block = dimension.getBlock(loc);
        if (block.typeId.match("lava")) {
            fixlavaStart = loc;
            break;
        }
    }

    if (!fixlavaStart) throw "commands.wedit:fixlava.noLava";

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("commands.wedit:fixlava.fixing");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(fixlavaStart, args.get("radius"), (ctx) => !!ctx.nextBlock.typeId.match("lava"));

        if (!blocks.size) return blocks;

        const history = session.history;
        const record = history.record();
        try {
            yield* history.trackRegion(record, blocks);
            let i = 0;
            for (const loc of blocks) {
                dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)).setType("lava");
                yield Jobs.setProgress(i++ / blocks.size);
            }
            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return blocks;
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${blocks.size}`);
});
