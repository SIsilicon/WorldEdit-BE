import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, regionBounds, sleep } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation = {
    name: "fillr",
    permission: "worldedit.utility.fillr",
    description: "commands.wedit:fillr.description",
    usage: [
        {
            name: "pattern",
            type: "Pattern",
        },
        {
            name: "radius",
            type: "float",
        },
        {
            name: "depth",
            type: "int",
            range: [1, null] as [number, null],
            default: -1,
        },
        {
            name: "direction",
            type: "Direction",
            default: new Cardinal(Cardinal.Dir.DOWN),
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const fillDir = (args.get("direction") as Cardinal).getDirection(builder);
    const pattern: Pattern = args.get("pattern");
    const depth: number = args.get(args.get("depth") == -1 ? "radius" : "depth");
    const startBlock = session.getPlacementPosition();

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Generating blocks...");
        // Stop filling at unloaded chunks
        const blocks = yield* floodFill(startBlock, args.get("radius"), (ctx, dir) => {
            const dotDir = fillDir.dot(dir);
            if (dotDir < 0) return false;
            if (fillDir.dot(ctx.pos.add(dir)) > depth - 1) return false;
            if (!dimension.getBlock(ctx.worldPos.add(dir))?.isAir) return false;
            return true;
        });

        if (!blocks.length) return blocks;
        const [min, max] = regionBounds(blocks);
        pattern.setContext(session, [min, max]);

        const history = session.getHistory();
        const record = history.record();
        try {
            yield history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                let block = dimension.getBlock(loc);
                while (!(block || (block = Jobs.loadBlock(loc)))) yield sleep(1);
                pattern.setBlock(block);
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
