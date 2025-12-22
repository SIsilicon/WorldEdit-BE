import { Vector3 } from "@minecraft/server";
import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { balloonPath, plotLine } from "./paths_func.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "line",
    permission: "worldedit.region.line",
    description: "commands.wedit:line.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { flag: "t", name: "thickness", type: "int", range: [0, config.maxBrushRadius] },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    if (session.selection.mode != "cuboid") throw "commands.wedit:line.invalidType";
    if (args.get("_using_item") && session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";
    const thickness = args.get("t-thickness") ?? 0;

    let pos1: Vector3, pos2: Vector3, start: Vector, end: Vector;
    if (session.selection.mode == "cuboid") {
        [pos1, pos2] = session.selection.points;
        [start, end] = session.selection.getRange();
        [start, end] = [start.sub(thickness), end.add(thickness)];
    }

    let count: number;

    yield* Jobs.run(session, 1, function* () {
        const history = session.history;
        const record = history.record();
        try {
            const curveSamples = yield* plotLine(Vector.from(pos1), Vector.from(pos2));
            const blocks = yield* balloonPath(curveSamples, thickness);
            const pattern = (<Pattern>(args.get("_using_item") ? session.globalPattern : args.get("pattern"))).withContext(session, [start, end], {
                strokePoints: Array.from(curveSamples),
                gradientRadius: thickness,
            });
            const mask = session.globalMask.withContext(session);

            yield* history.trackRegion(record, start, end);
            count = 0;
            for (const location of blocks) {
                const block = yield* Jobs.loadBlock(location);
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield;
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
