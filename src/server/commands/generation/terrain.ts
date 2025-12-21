import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText, Vector, regionSize } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";
import { Noise } from "@modules/noise.js";
import { recordBlockChanges } from "@modules/block_changes.js";

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
    const amplitude: number = args.get("amplitude") * 0.5;
    const frequency: number = args.get("frequency");
    const octaves: number = args.get("octaves");
    const seed: number = args.get("s-seed") ?? Math.floor(Math.random() * 1000000);
    const additive: boolean = args.has("a");

    const noise = new Noise(seed);
    const dimension = builder.dimension;

    const count = yield* Jobs.run(session, 1, function* () {
        let count = 0;
        let processed = 0;
        const totalOperations = size.x * size.z;

        const history = session.history;
        const record = history.record();
        const changes = recordBlockChanges(session, record);
        try {
            yield Jobs.nextStep("Generating terrain");
            for (let x = min.x; x <= max.x; x++) {
                for (let z = min.z; z <= max.z; z++) {
                    const noiseValue = (noise.octaveNoise(x * frequency, z * frequency, octaves, 0.5, 0.05) * 2 - 1) * amplitude + amplitude;
                    const terrainHeight = Math.floor(noiseValue * size.y);

                    let base = min.y;
                    if (additive) {
                        const testAt = { x, z, y: base };
                        if (!dimension.isChunkLoaded(testAt)) yield* Jobs.loadArea(testAt, testAt);
                        base = dimension.getTopmostBlock({ x, z }, max.y).y + 1;
                    }

                    for (let y = base; y <= Math.min(base + terrainHeight, max.y); y++) {
                        const loc = new Vector(x, y, z);
                        if (!dimension.isChunkLoaded(loc)) yield* Jobs.loadArea(loc, loc);
                        pattern.setBlock(changes.getBlock(loc));
                    }

                    processed++;
                    yield Jobs.setProgress(processed / totalOperations);
                }
            }
            count = yield* changes.flush();
            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return count;
    });
    return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
