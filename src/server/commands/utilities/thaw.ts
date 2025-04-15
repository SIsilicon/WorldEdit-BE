import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { Block, Vector3 } from "@minecraft/server";
import { getWorldHeightLimits } from "../../util.js";
import { CylinderShape } from "../../shapes/cylinder.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "thaw",
    permission: "worldedit.utility.thaw",
    description: "commands.wedit:thaw.description",
    usage: [
        { name: "size", type: "int", range: [1, null] },
        { name: "height", type: "int", range: [1, null], default: -1 },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const radius: number = args.get("size");
    const height: number = args.get("height") < 0 ? 4096 : (args.get("height") - 1) * 2 + 1;
    const origin = session.getPlacementPosition();

    const shape = new CylinderShape(height, radius);
    const range = shape.getRegion(origin);
    const heightLimits = getWorldHeightLimits(dimension);
    range[0].y = Math.max(range[0].y, heightLimits[0]);
    range[1].y = Math.min(range[1].y, heightLimits[1] - 1);

    return yield* Jobs.run(session, 2, function* () {
        yield Jobs.nextStep("Raycasting..."); // TODO: Localize
        let i = 0;

        const blocks: Block[] = [];
        const blockLocs: Vector3[] = [];
        const area = (range[1].x - range[0].x + 1) * (range[1].z - range[0].x + 1);

        const rayTraceOptions = {
            includeLiquidBlocks: true,
            includePassableBlocks: true,
            maxDistance: height,
        };

        for (let x = range[0].x; x <= range[1].x; x++)
            for (let z = range[0].z; z <= range[1].z; z++) {
                const yRange = shape.getYRange(x - origin.x, z - origin.z)?.map((y) => y + origin.y) as [number, number];
                if (!yRange) {
                    i++;
                    continue;
                }

                const loc = new Vector(x + 0.5, range[1].y + 1.01, z + 0.5);
                try {
                    const block = dimension.getBlockFromRay(loc, Vector.DOWN, rayTraceOptions)?.block;
                    if (block) {
                        blocks.push(block);
                        blockLocs.push(block.location);
                    }
                    // eslint-disable-next-line no-empty
                } catch {}

                yield Jobs.setProgress(i / area);
                i++;
            }

        yield Jobs.nextStep("Generating blocks..."); // TODO: Localize
        let changed = 0;
        i = 0;

        if (blocks.length) {
            const history = session.history;
            const record = history.record();
            try {
                yield* history.trackRegion(record, blockLocs);
                for (let block of blocks) {
                    const loc = block.location;
                    if (!block?.isValid) block = yield* Jobs.loadBlock(loc);

                    if (block.matches("ice")) {
                        block.setType("water");
                        changed++;
                    } else if (block.matches("snow_layer")) {
                        block.setType("air");
                        changed++;
                    }
                    yield Jobs.setProgress(i++ / blocks.length);
                }
                yield* history.commit(record);
            } catch (err) {
                history.cancel(record);
                throw err;
            }
        }

        return RawText.translate("commands.blocks.wedit:changed").with(`${changed}`);
    });
});
