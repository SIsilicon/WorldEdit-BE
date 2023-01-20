import { assertSelection } from "@modules/assert.js";
import { RawText, CommandPosition } from "@notbeer-api";
import { BlockLocation, Vector3 } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";
import { PlayerSession } from "server/sessions.js";
import { getWorldHeightLimits } from "server/util.js";

const registerInformation = {
  name: "chunk",
  permission: "worldedit.selection.chunk",
  description: "commands.wedit:chunk.description",
  usage: [
    {
      flag: "c"
    }, {
      flag: "s"
    }, {
      name: "coordinates",
      type: "xyz",
      default: new CommandPosition()
    }
  ]
};

function toChunk(loc: Vector3) {
  loc.x = Math.floor(loc.x / 16);
  loc.y = Math.floor(loc.y / 256);
  loc.z = Math.floor(loc.z / 16);
  return loc;
}

function setSelection(session: PlayerSession, chunks: [Vector3, Vector3]) {
  const heights = getWorldHeightLimits(session.getPlayer().dimension);
  session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
  session.selection.set(0, new BlockLocation(chunks[0].x * 16, heights[0], chunks[0].z * 16));
  session.selection.set(1, new BlockLocation(chunks[1].x * 16 + 15, heights[1], chunks[1].z * 16 + 15));
}

registerCommand(registerInformation, function (session, builder, args) {
  const useChunkCoordinates = args.has("c");
  const expandSelection = args.has("s");
  const coordinates = args.get("coordinates") as CommandPosition;

  if (expandSelection) {
    assertSelection(session);

    const range = session.selection.getRange();
    const chunks: [Vector3, Vector3] = [toChunk(range[0]), toChunk(range[1])];

    setSelection(session, chunks);

    return RawText.translate("commands.wedit:chunk.selected-multiple")
      .with(`${chunks[0].x}`)
      .with(`${chunks[0].y}`)
      .with(`${chunks[0].z}`)
      .with(`${chunks[1].x}`)
      .with(`${chunks[1].y}`)
      .with(`${chunks[1].z}`);

  } else {
    if (useChunkCoordinates) {
      coordinates.x *= 16;
      coordinates.y *= 256;
      coordinates.z *= 16;
    }

    const chunk = toChunk(coordinates.relativeTo(builder, true));
    setSelection(session, [chunk, chunk]);

    return RawText.translate("commands.wedit:chunk.selected")
      .with(`${chunk.x}`)
      .with(`${chunk.y}`)
      .with(`${chunk.z}`);
  }
});
