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
        {
            name: "pattern",
            type: "Pattern",
        },
        {
            flag: "t",
            name: "thickness",
            type: "int",
            range: [0, config.maxBrushRadius],
        },
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

    const dim = builder.dimension;
    const pattern = (<Pattern>(args.get("_using_item") ? session.globalPattern : args.get("pattern"))).withContext(session, [start, end]);
    const mask = session.globalMask.withContext(session);
    let count: number;

    yield* Jobs.run(session, 1, function* () {
        const history = session.getHistory();
        const record = history.record();
        try {
            yield* history.addUndoStructure(record, start, end);
            count = 0;
            for (const point of balloonPath(plotLine(Vector.from(pos1), Vector.from(pos2)), thickness)) {
                const block = dim.getBlock(point) ?? (yield* Jobs.loadBlock(point));
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield;
            }
            history.recordSelection(record, session);
            yield* history.addRedoStructure(record, start, end);
            history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
