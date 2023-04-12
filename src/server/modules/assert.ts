import { Player, Vector3 } from "@minecraft/server";
import { Server, Vector, RawText } from "@notbeer-api";
import { PlayerSession } from "../sessions.js";
import { canPlaceBlock } from "../util.js";
import { History } from "./history.js";

class UnloadedChunksError extends Error {
  name = "UnloadedChunksError";
}

function assertPermission(player: Player, perm: string) {
  if (!Server.player.hasPermission(player, perm)) {
    throw "commands.generic.wedit:noPermission";
  }
}

function assertCanBuildWithin(player: Player, min: Vector3, max: Vector3) {
  const minChunk = Vector.from(min).mul(1/16).floor().mul(16);
  const maxChunk = Vector.from(max).mul(1/16).ceil().mul(16);

  for (let z = minChunk.z; z < maxChunk.z; z += 16)
    for (let x = minChunk.x; x < maxChunk.x; x += 16) {
      if (!canPlaceBlock(new Vector(x, 0, z), player.dimension)) {
        throw new UnloadedChunksError("commands.generic.wedit:outsideWorld");
      }
    }
}

function assertClipboard(session: PlayerSession) {
  if (!session.clipboard) {
    throw RawText.translate("commands.generic.wedit:noClipboard");
  }
}

function assertSelection(session: PlayerSession) {
  if (!session.selection.isValid()) {
    throw RawText.translate("commands.generic.wedit:noSelection");
  }
}

function assertCuboidSelection(session: PlayerSession) {
  if (!session.selection.isValid() || !session.selection.isCuboid()) {
    throw RawText.translate("commands.generic.wedit:noCuboidSelection");
  }
}

function assertHistoryNotRecording(history: History) {
  if (history.isRecording()) {
    throw RawText.translate("worldedit.error.stillRecording");
  }
}

export { UnloadedChunksError, assertCanBuildWithin, assertClipboard, assertCuboidSelection, assertHistoryNotRecording, assertPermission, assertSelection };
