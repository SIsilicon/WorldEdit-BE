import { assertClipboard, assertSelection } from "@modules/assert.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { plotCurve } from "./paths_func.js";

const registerInformation: CommandInfo = {
    name: "path",
    permission: "worldedit.region.path",
    description: "commands.wedit:path.description",
    usage: [{ name: "spacing", type: "int", default: 1, range: [1, null] }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertClipboard(session);
    assertSelection(session);
    if (session.selection.mode != "convex") throw "commands.wedit:curve.invalidType";
    if (args.get("_using_item") && session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";

    const spacing = <number>args.get("spacing");

    const clipboard = session.clipboard;
    const volume = clipboard.getVolume();
    const offset = clipboard.getSize().mul(0.5).floor().mul(-1);
    const points = session.selection.points;

    const dim = builder.dimension;
    let count: number;

    yield* Jobs.run(session, 1, function* () {
        const history = session.history;
        const record = history.record();
        try {
            let index = 0;
            const loads: Vector[] = [];
            for (const point of plotCurve(points)) {
                if (index++ % spacing !== 0) continue;

                const loadAt = point.floor();
                const [start, end] = clipboard.getBounds(loadAt, { offset: offset });
                yield* history.trackRegion(record, start, end);
                loads.push(loadAt);
            }

            for (const loadAt of loads) {
                yield* clipboard.load(loadAt, dim, { offset: offset });
                yield count++ / (volume * loads.length);
            }

            history.trackSelection(record);
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
