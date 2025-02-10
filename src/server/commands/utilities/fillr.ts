import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, regionBounds } from "@notbeer-api";
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
    const depth: number = args.get(args.get("depth") == -1 ? "radius" : "depth");
    const startBlock = session.getPlacementPosition();

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Generating blocks...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(startBlock, args.get("radius"), (ctx, dir) => {
            const dotDir = fillDir.dot(dir);
            if (dotDir < 0) return false;
            if (fillDir.dot(ctx.pos.add(dir)) > depth - 1) return false;
            if (!ctx.nextBlock.isAir) return false;
            return true;
        });

        if (!blocks.length) return blocks;
        const [min, max] = regionBounds(blocks);
        const pattern = (<Pattern>args.get("pattern")).withContext(session, [min, max]);

        const history = session.getHistory();
        const record = history.record();
        try {
            yield* history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                pattern.setBlock(dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc)));
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
