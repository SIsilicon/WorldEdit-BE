import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, regionBounds } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { floodFill, FloodFillContext } from "./floodfill_func.js";

const registerInformation: CommandInfo = {
    name: "fill",
    permission: "worldedit.utility.fill",
    description: "commands.wedit:fill.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "radius", type: "float" },
        { name: "depth", type: "int", range: [1, null], default: 1 },
        { name: "direction", type: "Direction", default: new Cardinal(Cardinal.Dir.DOWN) },
    ],
};

interface fillContext extends FloodFillContext {
    fillDown?: boolean;
}

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const fillDir = (<Cardinal>args.get("direction")).getDirection(builder);
    const depth: number = args.get("depth");
    const startBlock = session.getPlacementPosition();

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Generating blocks...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill<fillContext>(startBlock, args.get("radius"), (ctx, dir) => {
            const dotDir = fillDir.dot(dir);
            if (dotDir < 0) return false;
            if (dotDir == 0 && ctx.fillDown) return false;
            if (fillDir.dot(ctx.pos.add(dir)) > depth - 1) return false;
            if (!ctx.nextBlock.isAir) return false;
            if (dotDir > 0) ctx.fillDown = true;
            return true;
        });

        if (!blocks.size) return blocks;
        const [min, max] = regionBounds(blocks);
        const pattern = (<Pattern>args.get("pattern")).withContext(session, [min, max]);

        const history = session.history;
        const record = history.record();
        try {
            yield* history.trackRegion(record, blocks);
            let i = 0;
            for (const loc of blocks) {
                pattern.setBlock(dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)));
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
