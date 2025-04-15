import { assertCuboidSelection } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, regionSize, regionVolume, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { copy } from "../clipboard/copy.js";
import { Vector3 } from "@minecraft/server";
import { RegionBuffer } from "@modules/region_buffer.js";

const registerInformation = {
    name: "stack",
    permission: "worldedit.region.stack",
    description: "commands.wedit:stack.description",
    usage: [
        {
            name: "count",
            type: "int",
            range: [1, null] as [number, null],
            default: 1,
        },
        {
            name: "offset",
            type: "Direction",
            default: new Cardinal(),
        },
        {
            name: "offsetMode",
            type: "enum",
            values: ["absolute", "relative"],
            default: "relative",
        },
        {
            name: "includeAir",
            type: "bool",
            default: true,
        },
        {
            name: "includeEntities",
            type: "bool",
            default: false,
        },
        {
            name: "mask",
            type: "Mask",
            default: null,
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    const amount = args.get("count");
    const [start, end] = session.selection.getRange();
    const dim = builder.dimension;
    const size = regionSize(start, end);

    const dir = args
        .get("offset")
        .getDirection(builder)
        .mul(args.get("offsetMode") === "absolute" ? 1 : size);
    let loadStart = start.offset(dir.x, dir.y, dir.z);
    let loadEnd = end.offset(dir.x, dir.y, dir.z);
    let count = 0;

    const loads: [Vector, Vector][] = [];
    const points: Vector3[] = [];
    for (let i = 0; i < amount; i++) {
        loads.push([loadStart, loadEnd]);
        points.push(loadStart, loadEnd);
        loadStart = loadStart.offset(dir.x, dir.y, dir.z);
        loadEnd = loadEnd.offset(dir.x, dir.y, dir.z);
    }
    const stackRegion = regionBounds(points);

    const history = session.history;
    const record = history.record();
    yield* Jobs.run(session, loads.length + 1, function* () {
        let tempStack: RegionBuffer;
        try {
            tempStack = yield* copy(session, args, false);
            yield* history.trackRegion(record, ...stackRegion);
            for (const load of loads) {
                yield Jobs.nextStep("Pasting blocks...");
                yield* tempStack.load(load[0], dim);
                count += regionVolume(load[0], load[1]);
            }

            history.trackSelection(record);
            session.selection.set(0, loads[loads.length - 1][0]);
            session.selection.set(1, loads[loads.length - 1][1]);

            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            session.deleteRegion(tempStack);
        }
    });
    return RawText.translate("commands.wedit:stack.explain").with(count);
});
