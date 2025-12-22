import { assertSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, regionBounds } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { balloonPath, plotCurve } from "./paths_func.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "curve",
    permission: "worldedit.region.curve",
    description: "commands.wedit:curve.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "thickness", type: "int", range: [0, config.maxBrushRadius], default: 0 },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    if (session.selection.mode != "convex") throw "commands.wedit:curve.invalidType";
    if (args.get("_using_item") && session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";
    const thickness = <number>args.get("thickness");

    const points = session.selection.points;
    const dim = builder.dimension;
    let count: number;

    yield* Jobs.run(session, 1, function* () {
        const history = session.history;
        const record = history.record();
        try {
            const curveSamples = yield* plotCurve(points);
            const blocks = yield* balloonPath(curveSamples, thickness);
            const [start, end] = regionBounds(blocks);
            const pattern = (<Pattern>(args.get("_using_item") ? session.globalPattern : args.get("pattern"))).withContext(session, [start, end], {
                strokePoints: Array.from(curveSamples),
                gradientRadius: thickness,
            });
            const mask = session.globalMask.withContext(session);

            yield* history.trackRegion(record, start, end);
            count = 0;
            for (const point of blocks) {
                const block = dim.getBlock(point) ?? (yield* Jobs.loadBlock(point));
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield count / blocks.size;
            }

            history.trackSelection(record);
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
