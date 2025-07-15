import { assertSelection } from "@modules/assert.js";
import { RawText, CommandPosition, Vector, CommandInfo } from "@notbeer-api";
import { Vector3 } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { PlayerSession } from "server/sessions.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation: CommandInfo = {
    name: "chunk",
    permission: "worldedit.selection.chunk",
    description: "commands.wedit:chunk.description",
    usage: [
        { flag: "c" },
        { flag: "s" },
        {
            subName: "_xz",
            args: [{ name: "coordinates", type: "xz", default: new CommandPosition() }],
        },
        {
            subName: "_",
            args: [{ name: "coordinates", type: "xyz" }],
        },
    ],
};

function toChunk(loc: Vector3) {
    loc.x = Math.floor(loc.x / 16);
    loc.y = Math.floor(loc.y / 16);
    loc.z = Math.floor(loc.z / 16);
    return loc;
}

function setSelection(session: PlayerSession, chunks: [Vector3, Vector3], useHeightLimits: boolean) {
    const heights: [number, number] = useHeightLimits ? getWorldHeightLimits(session.player.dimension) : [chunks[0].y * 16, chunks[1].y * 16 + 15];
    session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
    session.selection.set(0, new Vector(chunks[0].x * 16, heights[0], chunks[0].z * 16));
    session.selection.set(1, new Vector(chunks[1].x * 16 + 15, heights[1], chunks[1].z * 16 + 15));
}

registerCommand(registerInformation, function (session, builder, args) {
    const useChunkCoordinates = args.has("c");
    const expandSelection = args.has("s");
    const useHeightLimits = args.has("_xz");
    const coordinates = args.get("coordinates") as CommandPosition;

    if (expandSelection) {
        assertSelection(session);

        const range = session.selection.getRange();
        const chunks: [Vector3, Vector3] = [toChunk(range[0]), toChunk(range[1])];

        setSelection(session, chunks, useHeightLimits);

        return RawText.translate("commands.wedit:chunk.selected-multiple")
            .with(`${chunks[0].x}, ${useHeightLimits ? "" : `${chunks[0].y}, `}${chunks[0].z}`)
            .with(`${chunks[1].x}, ${useHeightLimits ? "" : `${chunks[1].y}, `}${chunks[1].z}`);
    } else {
        if (useChunkCoordinates) {
            coordinates.x *= 16;
            coordinates.y *= 16;
            coordinates.z *= 16;
        }

        const chunk = toChunk(coordinates.relativeTo(builder, true));
        setSelection(session, [chunk, chunk], useHeightLimits);

        return RawText.translate("commands.wedit:chunk.selected").with(`${chunk.x}, ${useHeightLimits ? "" : `${chunk.y}, `}${chunk.z}`);
    }
});
