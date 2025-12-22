import { assertClipboard, assertSelection } from "@modules/assert.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { plotCurve } from "./paths_func.js";
import { RegionLoadOptions } from "@modules/region_buffer.js";

const registerInformation: CommandInfo = {
    name: "path",
    permission: "worldedit.region.path",
    description: "commands.wedit:path.description",
    usage: [{ name: "spacing", type: "int", default: 1, range: [1, null] }, { subName: "rotated", args: [{ name: "offset", type: "int" }] }, { subName: "_" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertClipboard(session);
    assertSelection(session);
    if (session.selection.mode != "convex") throw "commands.wedit:curve.invalidType";
    if (args.get("_using_item") && session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";

    const spacing = <number>args.get("spacing");

    const clipboard = session.clipboard;
    const offset = clipboard.getSize().mul(0.5).floor().mul(-1);
    const points = session.selection.points;

    const dim = builder.dimension;
    let count = 0;

    yield* Jobs.run(session, 1, function* () {
        const history = session.history;
        const record = history.record();
        try {
            const loads: [Vector, RegionLoadOptions][] = [];
            const curve = Array.from(plotCurve(points));
            for (let i = 0; i < curve.length; i++) {
                if (i % spacing !== 0) continue;

                const point = curve[i];
                const loadAt = point.floor();
                const options: RegionLoadOptions = { offset };
                if (args.has("rotated")) {
                    const direction = i < curve.length - 5 ? Vector.sub(curve[Math.min(i + 5, curve.length - 1)], point) : Vector.sub(point, curve[Math.max(i - 5, 0)]);
                    const rotations = direction.normalized().toAngles();
                    options.rotation = new Vector((360 * rotations.x) / (Math.PI * 2), (360 * rotations.y) / (Math.PI * 2) + args.get("offset"), 0);
                }

                const [start, end] = clipboard.getBounds(loadAt, options);
                yield* history.trackRegion(record, start, end);
                loads.push([loadAt, options]);
            }

            for (const [loadAt, options] of loads) {
                yield* clipboard.load(loadAt, dim, options);
                yield count++ / loads.length;
            }

            history.trackSelection(record);
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${count * clipboard.getVolume()}`);
});
