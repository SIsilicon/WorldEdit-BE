import { assertSelection } from "@modules/assert.js";
import { RawText, CommandPosition } from "@notbeer-api";
import { BlockLocation } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

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

function toChunk(loc) {
  loc.x = Math.floor(loc.x / 16);
  loc.y = Math.floor(loc.y / 256);
  loc.z = Math.floor(loc.z / 16);
  return loc;
}

function setSelection(session, chunks) {
  session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
  session.selection.set(0, new BlockLocation(chunks[0].x * 16, chunks[0].y * 256, chunks[0].z * 16));
  session.selection.set(1, new BlockLocation(chunks[1].x * 16 + 15, chunks[1].y * 256 + 255, chunks[1].z * 16 + 15));
}

registerCommand(registerInformation, function (session, builder, args) {
  const useChunkCoordinates = args.has("c");
  const expandSelection = args.has("s");
  const coordinates = args.get("coordinates");

  if (expandSelection) {
    assertSelection(session);

    const range = session.selection.getRange();
    const chunks = [toChunk(range[0]), toChunk(range[1])];

    setSelection(session, chunks);

    return RawText.translate("commands.wedit:chunk.selected-multiple")
      .with(`${chunks[0].x}`)
      .with(`${chunks[0].y}`)
      .with(`${chunks[0].z}`)
      .with(`${chunks[1].x}`)
      .with(`${chunks[1].y}`)
      .with(`${chunks[1].z}`);

  } else {
    const chunk = useChunkCoordinates
      ? coordinates.relativeTo({ location: toChunk(builder.location) }, true)
      : toChunk(coordinates.relativeTo(builder, true));

    setSelection(session, [chunk, chunk]);

    return RawText.translate("commands.wedit:chunk.selected")
      .with(`${chunk.x}`)
      .with(`${chunk.y}`)
      .with(`${chunk.z}`);
  }
});
