import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Pattern } from "../../modules/pattern.js";
import { Jobs } from "../../modules/jobs.js";

const registerInformation: CommandInfo = {
    name: "naturalize",
    permission: "worldedit.region.naturalize",
    description: "commands.wedit:naturalize.description",
    usage: [
        { name: "top", type: "Pattern", default: new Pattern("grass_block") },
        { name: "middle", type: "Pattern", default: new Pattern("dirt") },
        { name: "bottom", type: "Pattern", default: new Pattern("stone") },
    ],
};

registerCommand(registerInformation, function* (session, _builder, args) {
    const selection = session.selection;
    const [min, max] = selection.getRange();

    const top = (<Pattern>args.get("top")).withContext(session, [min, max]);
    const middle = (<Pattern>args.get("middle")).withContext(session, [min, max]);
    const bottom = (<Pattern>args.get("bottom")).withContext(session, [min, max]);

    const changed = yield* Jobs.run(session, 2, function* () {
        const surfaceHeights = new Map<string, number>();

        yield Jobs.nextStep("commands.wedit:naturalize.finding");

        let processed = 0;
        const selectionSize = selection.getBlockCount();

        for (const location of selection.getBlocks()) {
            const block = yield* Jobs.loadBlock(location);

            if (block && !block.isAir && !block.isLiquid) {
                const key = `${location.x},${location.z}`;
                const currentHeight = surfaceHeights.get(key);

                if (currentHeight === undefined || location.y > currentHeight) {
                    surfaceHeights.set(key, location.y);
                }
            }

            processed++;
            yield Jobs.setProgress(processed / selectionSize);
        }

        yield Jobs.nextStep("commands.wedit:naturalize.naturalizing");

        const history = session.history;
        const record = history.record();

        let changedBlocks = 0;
        processed = 0;

        try {
            yield* history.trackRegion(record, min, max);

            for (const location of selection.getBlocks()) {
                const block = yield* Jobs.loadBlock(location);

                if (block && !block.isAir && !block.isLiquid) {
                    const surfaceY = surfaceHeights.get(`${location.x},${location.z}`);

                    if (surfaceY !== undefined) {
                        const depth = surfaceY - location.y;

                        let pattern: Pattern;

                        if (depth === 0) {
                            pattern = top;
                        } else if (depth <= 3) {
                            pattern = middle;
                        } else {
                            pattern = bottom;
                        }

                        if (pattern.setBlock(block)) {
                            changedBlocks++;
                        }
                    }
                }

                processed++;
                yield Jobs.setProgress(processed / selectionSize);
            }

            yield* history.commit(record);
        } catch (error) {
            history.cancel(record);
            throw error;
        }

        return changedBlocks;
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${changed}`);
});
