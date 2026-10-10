import { assertCuboidSelection } from "@modules/assert.js";
import { Cardinal, CardinalDirection } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { RegionBuffer, RegionLoadOptions } from "@modules/region_buffer.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { copy } from "../clipboard/copy.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "mirror",
    permission: "worldedit.region.mirror",
    description: "commands.wedit:mirror.description",
    usage: [{ flag: "a" }, { flag: "e" }, { flag: "s" }, { name: "direction", type: "Direction", default: new Cardinal(CardinalDirection.Left) }, { flag: "m", name: "mask", type: "Mask" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);

    const dir: Vector = args.get("direction").getDirection(builder);
    const flip = Vector.ONE;

    if (dir.x) flip.x *= -1;
    if (dir.y) flip.y *= -1;
    if (dir.z) flip.z *= -1;

    const [start] = session.selection.getRange();
    const origin = Vector.from(builder.location).floor().add(0.5);

    const transform: RegionLoadOptions = {
        offset: start.sub(origin),
        scale: flip,
    };

    const history = session.history;
    const record = history.record();

    let temp: RegionBuffer;
    let blockCount = 0;

    yield* Jobs.run(session, 2, function* () {
        try {
            temp = yield* copy(session, args, false);

            if (!temp) {
                throw RawText.translate("commands.generic.wedit:commandFail");
            }

            const [mirrorStart, mirrorEnd] = temp.getBounds(origin, transform);

            yield* history.trackRegion(record, mirrorStart, mirrorEnd);

            yield Jobs.nextStep("commands.wedit:paste.pasting");
            yield* temp.load(origin, builder.dimension, transform);

            if (args.has("s")) {
                history.trackSelection(record);
                session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
                session.selection.set(0, mirrorStart);
                session.selection.set(1, mirrorEnd);
            }

            blockCount = temp.getVolume();

            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            if (temp) session.deleteRegion(temp);
        }
    });

    return RawText.translate("commands.wedit:mirror.explain").with(`${blockCount}`);
});
