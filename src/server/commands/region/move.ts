
import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, regionBounds } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";
import { cut } from "../clipboard/cut.js";

const registerInformation = {
  name: "move",
  permission: "worldedit.region.move",
  description: "commands.wedit:move.description",
  usage: [
    {
      flag: "a"
    }, {
      flag: "e"
    }, {
      flag: "s"
    }, {
      name: "amount",
      type: "int",
      default: 1,
      range: [1, null] as [number, null]
    }, {
      name: "offset",
      type: "Direction",
      default: new Cardinal()
    }, {
      name: "replace",
      type: "Pattern",
      default: new Pattern("air")
    }, {
      flag: "m",
      name: "mask",
      type: "Mask"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const dir = args.get("offset").getDirection(builder).mul(args.get("amount"));
  const dim = builder.dimension;

  const [start, end] = session.selection.getRange();
  const movedStart = start.offset(dir.x, dir.y, dir.z);
  const movedEnd = end.offset(dir.x, dir.y, dir.z);

  assertCanBuildWithin(builder, start, end);
  assertCanBuildWithin(builder, movedStart, movedEnd);

  const history = session.getHistory();
  const record = history.record();
  const temp = session.createRegion(true);
  const job = Jobs.startJob(session, 4, regionBounds([start, end, movedStart, movedEnd]));
  let count: number;
  try {
    history.addUndoStructure(record, start, end, "any");
    history.addUndoStructure(record, movedStart, movedEnd, "any");

    if (yield* Jobs.perform(job, cut(session, args, args.get("replace"), temp), false)) {
      throw RawText.translate("commands.generic.wedit:commandFail");
    }
    count = temp.getBlockCount();

    Jobs.nextStep(job, "Pasting blocks...");
    yield* Jobs.perform(job, temp.loadProgressive(movedStart, dim), false);

    history.addRedoStructure(record, start, end, "any");
    history.addRedoStructure(record, movedStart, movedEnd, "any");

    if (args.has("s")) {
      history.recordSelection(record, session);
      session.selection.set(0, movedStart);
      session.selection.set(1, movedEnd);
      history.recordSelection(record, session);
    }
    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  } finally {
    session.deleteRegion(temp);
    Jobs.finishJob(job);
  }

  return RawText.translate("commands.wedit:move.explain").with(count);
});
