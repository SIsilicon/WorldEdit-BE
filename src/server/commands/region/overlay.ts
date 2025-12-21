import { assertCuboidSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, Vector, regionSize } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Server } from "@notbeer-api";
import { recordBlockChanges } from "@modules/block_changes.js";

const registerInformation: CommandInfo = {
    name: "overlay",
    permission: "worldedit.region.overlay",
    description: "commands.wedit:overlay.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "depth", type: "int", default: 1 },
        { name: "surfaceMask", type: "Mask", default: new Mask() },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);

    const [min, max] = session.selection.getRange();
    const size = regionSize(min, max);

    const pattern: Pattern = args.get("pattern").withContext(session, [min, max]);
    const surfaceMask: Mask = args.get("surfaceMask").withContext(session);
    const globalMask = session.globalMask?.withContext(session);
    const depth: number = args.get("depth");

    const isAirOrFluid = Server.block.isAirOrFluid;

    const history = session.history;
    const record = history.record();
    const blockChanges = recordBlockChanges(session, record);

    const count = yield* Jobs.run(session, 1, function* () {
        let count = 0;
        let processed = 0;
        const totalOperations = size.x * size.z;

        try {
            yield Jobs.nextStep("Generating blocks...");
            for (let x = min.x; x <= max.x; x++) {
                for (let z = min.z; z <= max.z; z++) {
                    const trace = new Vector(x, max.y, z);
                    while (trace.y >= min.y) {
                        const block = blockChanges.getBlock(trace);
                        if (!isAirOrFluid(block.permutation) && surfaceMask.matchesBlock(block)) {
                            for (let i = 0; i < Math.abs(depth); i++) {
                                const loc = trace.offset(0, depth > 0 ? -i : i + 1, 0);
                                if (loc.y < min.y || loc.y > max.y) break;
                                const block = blockChanges.getBlock(loc);
                                if (globalMask.matchesBlock(block)) pattern.setBlock(block);
                            }
                            break;
                        }
                        trace.y--;
                    }
                    processed++;
                    yield Jobs.setProgress(processed / totalOperations);
                }
            }

            count = yield* blockChanges.flush();
            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return count;
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
