import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, Vector, regionIterateBlocks, regionIterateChunks, regionSize } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";
import { Noise } from "@modules/noise.js";
import { BlockVolume } from "@minecraft/server";

const registerInformation: CommandInfo = {
    name: "terrain",
    permission: "worldedit.generation.terrain",
    description: "commands.wedit:terrain.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "amplitude", type: "float", range: [0, undefined], default: 1 },
        { name: "frequency", type: "float", range: [0, undefined], default: 1 },
        { name: "octaves", type: "int", range: [1, undefined], default: 1 },
        { flag: "s", name: "seed", type: "int" },
        { flag: "a" },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);

    const [start, end] = session.selection.points;
    const size = regionSize(start, end);
    const min = Vector.min(start, end).floor();
    const max = Vector.max(start, end).floor();

    const pattern: Pattern = args.get("pattern").withContext(session, [min, max]);
    const mask = session.globalMask?.withContext(session);
    const amplitude: number = args.get("amplitude") * 0.5;
    const frequency: number = args.get("frequency");
    const octaves: number = args.get("octaves");
    const seed: number = args.get("s-seed") ?? Math.floor(Math.random() * 1000000);
    const additive: boolean = args.has("a");

    const noise = new Noise(seed);
    const dimension = builder.dimension;

    const count = yield* Jobs.run(session, 2, function* () {
        let count = 0;
        let processed = 0;
        const totalOperations = size.x * size.z;
        const columns = new Map<string, { minY: number; maxY: number }>();

        const history = session.history;
        const record = history.record();
        try {
            yield Jobs.nextStep("commands.wedit:terrain.calculating");
            for (const chunk of regionIterateChunks(min, max)) {
                for (const { x, z } of regionIterateBlocks(chunk[0], { x: chunk[1].x, y: chunk[0].y, z: chunk[1].z })) {
                    let base: number | undefined = min.y;
                    if (additive) {
                        const testAt = { x, z, y: base };
                        yield* Jobs.loadArea(testAt, testAt);
                        base = (dimension.getTopmostBlock({ x, z }, max.y)?.y ?? dimension.heightRange.min) + 1;
                        if (base < min.y) base = undefined;
                    }

                    if (base !== undefined) {
                        const noiseValue = (noise.octaveNoise(x * frequency, z * frequency, octaves, 0.5, 0.05) * 2 - 1) * amplitude + amplitude;
                        const terrainHeight = Math.floor(noiseValue * size.y);
                        columns.set(`${x},${z}`, { minY: base, maxY: Math.min(base + terrainHeight, max.y) });
                    }

                    yield Jobs.setProgress(++processed / totalOperations);
                }
            }

            processed = 0;
            const simpleMask = mask.isSimple();
            yield Jobs.nextStep("commands.wedit:blocks.generating");

            yield* history.trackRegion(record, min, max);
            for (const [key, { minY, maxY }] of columns) {
                const [x, z] = key.split(",").map(Number);
                yield* Jobs.loadArea({ x, y: minY, z }, { x, y: maxY, z });
                if (simpleMask) {
                    count += pattern.fillBlocks(dimension, new BlockVolume({ x, y: minY, z }, { x, y: maxY, z }), mask);
                } else {
                    for (let y = minY; y <= maxY; y++) {
                        const block = dimension.getBlock({ x, y, z });
                        if (mask.matchesBlock(block)) {
                            pattern.setBlock(block);
                            count++;
                        }
                    }
                }
                yield Jobs.setProgress(++processed / columns.size);
            }

            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return count;
    });
    return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
});
