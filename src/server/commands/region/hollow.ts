import { Vector3 } from "@minecraft/server";
import { assertSelection } from "@modules/assert.js";
import { JobFunction, Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { Server, RawText, Vector, iterateChunk, regionVolume, CommandInfo } from "@notbeer-api";
import { getWorldHeightLimits, locToString, stringToLoc } from "server/util.js";
import { PlayerSession } from "server/sessions.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "hollow",
    permission: "worldedit.region.hollow",
    description: "commands.wedit:hollow.description",
    usage: [
        { name: "thickness", type: "int", range: [1, null], default: 1 },
        { name: "pattern", type: "Pattern", default: new Pattern("air") },
    ],
};

function* hollow(session: PlayerSession, pattern: Pattern, thickness: number): Generator<JobFunction | Promise<unknown>, number> {
    const [min, max] = session.selection.getRange();
    const dimension = session.player.dimension;
    const [minY, maxY] = getWorldHeightLimits(dimension);
    const mask = session.globalMask.withContext(session);
    min.y = Math.max(minY, min.y);
    max.y = Math.min(maxY, max.y);
    const canGenerate = max.y >= min.y;

    pattern = pattern.withContext(session, [min, max]);

    const history = session.history;
    const record = history.record();
    try {
        let count = 0;
        let progress = 0;
        let volume = regionVolume(min, max);

        if (canGenerate) {
            yield Jobs.nextStep("commands.wedit:blocks.calculating");
            const locStringSet: Set<string> = new Set();
            for (const loc of session.selection.getBlocks()) {
                yield* iterateChunk(Jobs.setProgress(++progress / volume));
                locStringSet.add(locToString(loc));
            }

            progress = 0;
            volume = locStringSet.size;
            yield Jobs.nextStep("commands.wedit:blocks.calculating");
            for (const loc of session.selection.getBlocks({ hollow: true })) {
                if (loc.y < min.y || loc.y > max.y) continue;

                const queue: Vector3[] = [loc];
                while (queue.length != 0) {
                    const loc = queue.shift();
                    const locString = locToString(loc);
                    yield Jobs.setProgress(progress / volume);
                    progress++;
                    if (!locStringSet.has(locString)) continue;
                    if (!Server.block.isAirOrFluid((yield* Jobs.loadBlock(loc)!).permutation)) continue;
                    locStringSet.delete(locString);
                    for (const offset of [
                        [0, 1, 0],
                        [0, -1, 0],
                        [1, 0, 0],
                        [-1, 0, 0],
                        [0, 0, 1],
                        [0, 0, -1],
                    ] as [number, number, number][]) {
                        queue.push(Vector.add(loc, offset));
                    }
                }
            }

            for (let i = 1; i <= thickness; i++) {
                const surface: string[] = [];
                outer: for (const locString of locStringSet) {
                    yield Jobs.setProgress(progress / volume);
                    progress += 0.5 / thickness;
                    for (const offset of [
                        [0, 1, 0],
                        [0, -1, 0],
                        [1, 0, 0],
                        [-1, 0, 0],
                        [0, 0, 1],
                        [0, 0, -1],
                    ] as [number, number, number][]) {
                        if (!locStringSet.has(locToString(stringToLoc(locString).add(offset)))) {
                            surface.push(locString);
                            continue outer;
                        }
                    }
                }
                for (const locString of surface) {
                    yield* iterateChunk(Jobs.setProgress(progress / volume));
                    progress += 0.5 / thickness;
                    locStringSet.delete(locString);
                }
            }

            progress = 0;
            volume = locStringSet.size;
            yield Jobs.nextStep("commands.wedit:blocks.generating");
            yield* history.trackRegion(record, min, max);
            for (const locString of locStringSet) {
                const loc = stringToLoc(locString);
                const block = (yield* Jobs.loadBlock(loc))!;
                if (mask.matchesBlock(block) && pattern.setBlock(block)) count++;
                yield* iterateChunk(Jobs.setProgress(++progress / volume));
            }
        }

        yield* history.commit(record);
        return count;
    } catch (e) {
        history.cancel(record);
        throw e;
    }
}

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    const pattern: Pattern = args.get("pattern");
    const thickness = args.get("thickness") as number;
    const count = yield* Jobs.run(session, 3, hollow(session, pattern, thickness));
    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
