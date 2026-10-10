import { assertCuboidSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, regionBounds, Vector, VectorSet } from "@notbeer-api";

import { registerCommand } from "../register_commands.js";
import { plotLine, plotRope } from "./paths_func.js";

const registerInformation: CommandInfo = {
    name: "rope",
    permission: "worldedit.region.rope",
    description: "commands.wedit:rope.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        {
            name: "extraLength",
            type: "float",
            range: [0, 1000],
            default: 5,
        },
        {
            name: "width",
            type: "int",
            range: [1, 256],
            default: 1,
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);

    if (session.selection.mode != "cuboid") {
        throw "commands.wedit:rope.invalidType";
    }

    const pattern = <Pattern>args.get("pattern");
    const extraLength = <number>args.get("extraLength");
    const width = <number>args.get("width");

    const [pos1, pos2] = session.selection.points;

    let count = 0;

    yield* Jobs.run(session, 1, function* () {
        const history = session.history;
        const record = history.record();

        try {
            const rope = yield* plotRope(pos1, pos2, extraLength);

            const blocks = new VectorSet<Vector>();

            const dx = pos2.x - pos1.x;
            const dz = pos2.z - pos1.z;
            const horizontalLength = Math.hypot(dx, dz);

            let perpendicularX = 1;
            let perpendicularZ = 0;

            if (horizontalLength > 0) {
                perpendicularX = -dz / horizontalLength;
                perpendicularZ = dx / horizontalLength;
            }

            // Scale to Minecraft's block grid so width stays
            // roughly consistent even for diagonal bridges.
            const gridScale = 1 / Math.max(Math.abs(perpendicularX), Math.abs(perpendicularZ));

            const halfWidth = ((width - 1) / 2) * gridScale;

            for (const center of rope) {
                const left = new Vector(center.x - perpendicularX * halfWidth, center.y, center.z - perpendicularZ * halfWidth).add(0.5).floor();

                const right = new Vector(center.x + perpendicularX * halfWidth, center.y, center.z + perpendicularZ * halfWidth).add(0.5).floor();

                for (const block of plotLine(left, right)) {
                    blocks.add(block);
                }
            }

            const [start, end] = regionBounds(blocks);

            const placementPattern = pattern.withContext(session, [start, end], {
                strokePoints: Array.from(rope),
                gradientRadius: (width - 1) / 2,
            });

            const mask = session.globalMask.withContext(session);

            yield* history.trackRegion(record, start, end);

            for (const location of blocks) {
                const block = yield* Jobs.loadBlock(location);

                if (mask.matchesBlock(block) && placementPattern.setBlock(block)) {
                    count++;
                }

                yield count / blocks.size;
            }

            history.trackSelection(record);
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
