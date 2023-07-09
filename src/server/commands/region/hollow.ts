import { Vector3 } from "@minecraft/server";
import { assertSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { Server, RawText, Vector, iterateChunk, regionVolume } from "@notbeer-api";
import { canPlaceBlock, getWorldHeightLimits, locToString, stringToLoc } from "server/util.js";
import { PlayerSession } from "server/sessions.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "hollow",
  permission: "worldedit.region.hollow",
  description: "commands.wedit:hollow.description",
  usage: [
    {
      name: "thickness",
      type: "int",
      range: [1, null] as [number, null],
      default: 1
    },
    {
      name: "pattern",
      type: "Pattern",
      default: new Pattern("air")
    }
  ]
};

function* hollow(session: PlayerSession, pattern: Pattern, thickness: number): Generator<string | number, number> {
  const [min, max] = session.selection.getRange();
  const dimension = session.getPlayer().dimension;
  const [minY, maxY] = getWorldHeightLimits(dimension);
  min.y = Math.max(minY, min.y);
  max.y = Math.min(maxY, max.y);
  const canGenerate = max.y >= min.y;

  pattern.setContext(session, [min, max]);

  const history = session.getHistory();
  const record = history.record();
  try {
    let count = 0;
    let progress = 0;
    let volume = regionVolume(min, max);

    if (canGenerate) {
      yield "Calculating shape...";
      const locStringSet: Set<string> = new Set();
      for (const loc of session.selection.getBlocks()) {
        if (iterateChunk()) yield progress / volume;
        progress++;
        locStringSet.add(locToString(loc));
      }

      progress = 0;
      volume = locStringSet.size;
      yield "Calculating blocks...";
      for (const loc of session.selection.getBlocks({ hollow: true })) {
        const queue: Vector3[] = [loc];
        while (queue.length != 0) {
          const loc = queue.shift();
          const locString = locToString(loc);
          yield progress / volume;
          if (!locStringSet.has(locString)) continue;
          progress++;
          if (canPlaceBlock(loc, dimension) && !Server.block.isAirOrFluid(dimension.getBlock(loc).permutation)) continue;
          locStringSet.delete(locString);
          for (const offset of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as [number, number, number][]) {
            queue.push(Vector.add(loc, offset));
          }
        }
      }

      for (let i = 1; i <= thickness; i++) {
        const surface: string[] = [];
        outer: for (const locString of locStringSet) {
          yield progress / volume;
          progress += 0.5 / thickness;
          for (const offset of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as [number, number, number][]) {
            if (!locStringSet.has(locToString(stringToLoc(locString).add(offset)))) {
              surface.push(locString);
              continue outer;
            }
          }
        }
        for (const locString of surface) {
          if (iterateChunk()) yield progress / volume;
          progress += 0.5 / thickness;
          locStringSet.delete(locString);
        }
      }

      progress = 0;
      volume = locStringSet.size;
      yield "Generating blocks...";
      history.addUndoStructure(record, min, max);
      for (const locString of locStringSet) {
        const block = dimension.getBlock(stringToLoc(locString));
        if (session.globalMask.matchesBlock(block) && pattern.setBlock(block)) count++;
        if (iterateChunk()) yield progress / volume;
        progress++;
      }
      history.recordSelection(record, session);
      history.addRedoStructure(record, min, max);
    }

    history.commit(record);
    return count;
  } catch (e) {
    history.cancel(record);
    throw e;
  }
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw RawText.translate("worldEdit.selectionFill.noPattern");
  }

  const pattern: Pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");
  const thickness = args.get("thickness") as number;

  const job = Jobs.startJob(session, 3, session.selection.getRange());
  const count = yield* Jobs.perform(job, hollow(session, pattern, thickness));
  Jobs.finishJob(job);
  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
