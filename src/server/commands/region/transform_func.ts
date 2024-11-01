import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { RegionLoadOptions } from "@modules/region_buffer.js";
import { regionTransformedBounds, Vector } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { set } from "./set.js";
import { JobFunction, Jobs } from "@modules/jobs.js";
import { rotationFlipMatrix } from "server/util.js";

// TODO: fix the bounds sometimes not encompassing the new geometry
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* transformSelection(session: PlayerSession, builder: Player, args: Map<string, any>, options: RegionLoadOptions): Generator<JobFunction | Promise<unknown>> {
    assertCuboidSelection(session);
    const history = session.getHistory();
    const record = history.record();
    const temp = session.createRegion(true);
    try {
        const [start, end] = session.selection.getRange();
        const dim = builder.dimension;

        const center = Vector.from(start).add(end).mul(0.5);
        const origin = center.sub(args.has("o") ? Vector.ZERO : Vector.sub(center, Vector.from(builder.location).floor()));
        yield Jobs.nextStep("Gettings blocks...");
        yield* temp.save(start, end, dim);

        const [newStart, newEnd] = regionTransformedBounds(start, end, rotationFlipMatrix(options.rotation ?? Vector.ZERO, options.flip ?? Vector.ONE, origin));

        yield history.addUndoStructure(record, start, end, "any");
        yield history.addUndoStructure(record, newStart, newEnd, "any");

        yield* set(session, new Pattern("air"), null, false);
        yield Jobs.nextStep("Transforming blocks...");
        yield* temp.load(newStart, dim, options);

        if (args.has("s")) {
            history.recordSelection(record, session);
            session.selection.set(0, newStart);
            session.selection.set(1, newEnd);
            history.recordSelection(record, session);
        }

        yield history.addRedoStructure(record, newStart, newEnd, "any");
        yield history.addRedoStructure(record, start, end, "any");
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        session.deleteRegion(temp);
    }
}
