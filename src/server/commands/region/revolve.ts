import { assertCuboidSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, regionOffset, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { copy } from "../clipboard/copy.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { Cardinal } from "@modules/directions.js";

const registerInformation = {
    name: "revolve",
    permission: "worldedit.region.revolve",
    description: "commands.wedit:revolve.description",
    usage: [
        {
            flag: "a",
        },
        {
            flag: "s",
        },
        {
            name: "count",
            type: "int",
            range: [2, null] as [number, null],
        },
        {
            name: "start",
            type: "float",
            default: 0,
        },
        {
            name: "end",
            type: "float",
            default: 360,
        },
        {
            name: "heightDiff",
            type: "int",
            default: 0,
        },
        {
            flag: "d",
            name: "direction",
            type: "Direction",
        },
        {
            flag: "m",
            name: "mask",
            type: "Mask",
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    const amount = args.get("count");
    const dir = (<Cardinal>args.get("d-direction"))?.getDirection(builder) ?? Vector.UP;
    const [start, end] = session.selection.getRange();
    const heightDiff = args.get("heightDiff");
    const [startRotation, endRotation] = [args.get("start"), args.get("end")];
    const origin = Vector.from(builder.location).floor().add(0.5);
    const offset = start.sub(origin);
    const dim = builder.dimension;

    // [load position, rotation angles]
    const loads: [Vector, Vector][] = [];
    const points: Vector[] = [];
    const [originStart, originEnd] = regionOffset(start, end, offset.mul(-1));
    for (let i = 0; i <= amount; i++) {
        const t = i / amount;
        const rotation = dir.mul((1 - t) * startRotation + t * endRotation);
        const height = dir.mul(Math.round(t * heightDiff));
        const [loadStart, loadEnd] = RegionBuffer.createBounds(originStart, originEnd, { offset: offset.add(height), rotation });
        loads.push([origin.add(height), rotation]);
        points.push(loadStart, loadEnd);
    }
    const revolveRegion = regionBounds(points);

    let count = 0;
    const history = session.getHistory();
    const record = history.record();

    yield* Jobs.run(session, loads.length + 1, function* () {
        let tempRevolve: RegionBuffer;
        try {
            tempRevolve = yield* copy(session, args, false);
            yield* history.addUndoStructure(record, ...revolveRegion, "any");
            for (const [loadPosition, rotation] of loads) {
                yield Jobs.nextStep("Pasting blocks...");
                yield* tempRevolve.load(loadPosition, dim, { rotation, offset });
                count += tempRevolve.getVolume();
            }
            yield* history.addRedoStructure(record, ...revolveRegion, "any");

            if (args.has("s")) {
                history.recordSelection(record, session);
                session.selection.set(0, points[points.length - 2]);
                session.selection.set(1, points[points.length - 1]);
                history.recordSelection(record, session);
            }

            history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            session.deleteRegion(tempRevolve);
        }
    });
    return RawText.translate("commands.wedit:revolve.explain").with(count);
});
