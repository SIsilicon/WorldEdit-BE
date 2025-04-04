import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { RegionBuffer, RegionLoadOptions } from "@modules/region_buffer.js";
import { Vector } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { set } from "./set.js";
import { JobFunction, Jobs } from "@modules/jobs.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* transformSelection(session: PlayerSession, builder: Player, args: Map<string, any>, options: RegionLoadOptions): Generator<JobFunction | Promise<unknown>> {
    assertCuboidSelection(session);
    const history = session.history;
    const record = history.record();
    let temp: RegionBuffer;
    try {
        const [start, end] = session.selection.getRange();
        const dim = builder.dimension;

        const center = Vector.from(start).add(end.add(1)).mul(0.5);
        const origin = args.has("o") ? center : Vector.from(builder.location).floor().add(0.5);
        options = { offset: start.sub(origin), ...options };
        options.mask = options.mask?.withContext(session);
        yield Jobs.nextStep("Gettings blocks...");
        temp = yield* session.createRegion(start, end);

        const [newStart, newEnd] = temp.getBounds(origin, options);

        yield* history.trackRegion(record, start, end);
        yield* history.trackRegion(record, newStart, newEnd);

        yield* set(session, new Pattern("air"), null, false);
        yield Jobs.nextStep("Transforming blocks...");
        yield* temp.load(origin, dim, options);

        if (args.has("s")) {
            history.trackSelection(record);
            session.selection.set(0, newStart);
            session.selection.set(1, newEnd);
        }

        yield* history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        session.deleteRegion(temp);
    }
}
