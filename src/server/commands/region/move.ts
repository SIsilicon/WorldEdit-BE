import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";
import { cut } from "../clipboard/cut.js";
import { RegionBuffer } from "@modules/region_buffer.js";

const registerInformation = {
    name: "move",
    permission: "worldedit.region.move",
    description: "commands.wedit:move.description",
    usage: [
        {
            flag: "a",
        },
        {
            flag: "e",
        },
        {
            flag: "s",
        },
        {
            name: "amount",
            type: "int",
            default: 1,
            range: [1, null] as [number, null],
        },
        {
            name: "offset",
            type: "Direction",
            default: new Cardinal(),
        },
        {
            name: "replace",
            type: "Pattern",
            default: new Pattern("air"),
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
    const dir = args.get("offset").getDirection(builder).mul(args.get("amount"));
    const dim = builder.dimension;

    const [start, end] = session.selection.getRange();
    const movedStart = start.offset(dir.x, dir.y, dir.z);
    const movedEnd = end.offset(dir.x, dir.y, dir.z);

    const history = session.history;
    const record = history.record();
    let count: number;
    yield* Jobs.run(session, 4, function* () {
        let temp: RegionBuffer;
        try {
            yield* history.trackRegion(record, start, end);
            yield* history.trackRegion(record, movedStart, movedEnd);
            if (!(temp = yield* cut(session, args, args.get("replace"), false))) {
                throw RawText.translate("commands.generic.wedit:commandFail");
            }
            count = temp.getVolume();

            yield Jobs.nextStep("Pasting blocks...");
            yield* temp.load(movedStart, dim);

            if (args.has("s")) {
                history.trackSelection(record);
                session.selection.set(0, movedStart);
                session.selection.set(1, movedEnd);
            }
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            session.deleteRegion(temp);
        }
    });
    return RawText.translate("commands.wedit:move.explain").with(count);
});
