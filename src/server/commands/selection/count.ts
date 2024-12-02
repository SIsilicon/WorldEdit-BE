import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "count",
    description: "commands.wedit:count.description",
    permission: "worldedit.analysis.count",
    usage: [
        {
            name: "mask",
            type: "Mask",
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    const mask = (<Mask>args.get("mask")).withContext(session);
    const dimension = builder.dimension;

    const total = session.selection.getBlockCount();
    const count = yield* Jobs.run(session, 1, function* () {
        let i = 0;
        let count = 0;
        yield Jobs.nextStep("Counting blocks...");
        for (const loc of session.selection.getBlocks()) {
            const block = dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc));
            count += mask.matchesBlock(block) ? 1 : 0;
            yield Jobs.setProgress(++i / total);
        }
        return count;
    });
    return RawText.translate("commands.wedit:count.explain").with(count);
});
