import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText, Vector, sleep } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation: CommandInfo = {
    name: "jumpto",
    permission: "worldedit.navigation.jumpto.command",
    description: "commands.wedit:jumpto.description",
    aliases: ["j"],
};

registerCommand(registerInformation, function* (session, builder) {
    let hit = PlayerUtil.traceForBlock(builder);
    const start = builder.getHeadLocation();
    const dir = builder.getViewDirection();
    const maxDistance = config.traceDistance;
    if (!hit || !builder.dimension.isChunkLoaded(hit)) {
        let lastLoadedPoint = Vector.from(start).floor();
        let distance = 0;
        const epsilon = 1e-4;

        while (distance < maxDistance) {
            const sampleDistance = Math.min(distance + epsilon, maxDistance);
            const sample = Vector.add(start, Vector.mul(dir, sampleDistance));
            const chunkSample = sample.floor();

            if (!builder.dimension.isChunkLoaded(chunkSample)) break;

            const chunkMinX = Math.floor(sample.x / 16) * 16;
            const chunkMinZ = Math.floor(sample.z / 16) * 16;

            let tExitX = Infinity;
            if (dir.x > 0) tExitX = (chunkMinX + 16 - start.x) / dir.x;
            else if (dir.x < 0) tExitX = (chunkMinX - start.x) / dir.x;

            let tExitZ = Infinity;
            if (dir.z > 0) tExitZ = (chunkMinZ + 16 - start.z) / dir.z;
            else if (dir.z < 0) tExitZ = (chunkMinZ - start.z) / dir.z;

            const exitDistance = Math.min(tExitX, tExitZ, maxDistance);
            if (!Number.isFinite(exitDistance)) {
                const endPoint = new Vector(start.x + dir.x * maxDistance, start.y + dir.y * maxDistance, start.z + dir.z * maxDistance).floor();
                if (builder.dimension.isChunkLoaded(endPoint)) lastLoadedPoint = endPoint;
                break;
            }

            if (exitDistance <= distance + epsilon) {
                distance += epsilon;
                continue;
            }

            const segmentEnd = new Vector(start.x + dir.x * exitDistance, start.y + dir.y * exitDistance, start.z + dir.z * exitDistance).floor();
            if (!builder.dimension.isChunkLoaded(segmentEnd)) break;

            lastLoadedPoint = segmentEnd;
            distance = exitDistance;
        }

        hit = lastLoadedPoint;
    }
    builder.teleport(hit);
    while (!builder.dimension.getBlock(hit)) yield sleep(1);
    getCommandFunc("unstuck")(session, builder, new Map());

    return RawText.translate("commands.wedit:jumpto.explain");
});
