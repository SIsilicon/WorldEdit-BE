import { Server } from "@notbeer-api";
import { Location } from "@minecraft/server";
import { copy } from "./copy.js";
import { set } from "../region/set.js";
import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { PlayerSession } from "server/sessions.js";
import { BlockAreaSize } from "@minecraft/server";

const registerInformation = {
  name: "cut",
  permission: "worldedit.clipboard.cut",
  description: "commands.wedit:cut.description",
  usage: [
    {
      flag: "a"
    }, {
      flag: "e"
    }, {
      name: "fill",
      type: "Pattern",
      default: new Pattern("air")
    }, {
      flag: "m",
      name: "mask",
      type: "Mask"
    }
  ]
};

/**
 * Cuts a region into a buffer (session's clipboard by default). When performed in a job, takes 3 steps to execute.
 * @param session The session whose player is running this command
 * @param args The arguments that change how the cutting will happen
 * @param fill The pattern to fill after cutting the region out
 * @param buffer An optional buffer to place the cut in. Leaving it blank cuts to the clipboard instead
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* cut(session: PlayerSession, args: Map<string, any>, fill: Pattern = new Pattern("air"), buffer: RegionBuffer = null): Generator<number | string | Promise<unknown>, boolean> {
  const usingItem = args.get("_using_item");
  const dim = session.getPlayer().dimension;
  const mask: Mask = usingItem ? session.globalMask : (args.has("m") ? args.get("m-mask") : undefined);
  const includeEntities: boolean = usingItem ? session.includeEntities : args.has("e");
  const [start, end] = session.selection.getRange();

  if (yield* copy(session, args, buffer)) {
    return true;
  }

  yield* set(session, fill, mask, false);
  if (includeEntities) {
    const entityQuery = {
      "location": new Location(start.x, start.y, start.z),
      "volume": new BlockAreaSize(end.x - start.x, end.y - start.y, end.z - start.z)
    };
    for (const entity of dim.getEntities(entityQuery)) {
      entity.nameTag = "wedit:marked_for_deletion";
    }
    Server.runCommand("execute @e[name=wedit:marked_for_deletion] ~~~ tp @s ~ -512 ~", dim);
    Server.runCommand("kill @e[name=wedit:marked_for_deletion]", dim);
  }
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const [start, end] = session.selection.getRange();
  assertCanBuildWithin(builder, start, end);

  const history = session.getHistory();
  const record = history.record();
  const job = (yield Jobs.startJob(session, 3, [start, end])) as number;
  try {
    history.recordSelection(record, session);
    yield history.addUndoStructure(record, start, end, "any");

    if (yield* Jobs.perform(job, cut(session, args, args.get("fill")), false)) {
      throw RawText.translate("commands.generic.wedit:commandFail");
    }

    yield history.addRedoStructure(record, start, end, "any");
    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  } finally {
    Jobs.finishJob(job);
  }

  return RawText.translate("commands.wedit:cut.explain").with(`${session.clipboard.getBlockCount()}`);
});
