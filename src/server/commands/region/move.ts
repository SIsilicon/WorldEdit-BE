
import { set } from "./set.js";
import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, regionBounds } from "@notbeer-api";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
  name: "move",
  permission: "worldedit.region.move",
  description: "commands.wedit:move.description",
  usage: [
    {
      name: "amount",
      type: "int",
      default: 1,
      range: [1, null] as [number, null]
    }, {
      name: "offset",
      type: "Direction",
      default: new Cardinal()
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
  const temp = session.createRegion(false);
  const job = Jobs.startJob(session, 3, regionBounds([start, end, movedStart, movedEnd]));
  let count: number;
  try {
    history.addUndoStructure(record, start, end, "any");
    history.addUndoStructure(record, movedStart, movedEnd, "any");

    Jobs.nextStep(job, "Copying blocks...");
    yield* Jobs.perform(job, temp.saveProgressive(start, end, dim), false);
    Jobs.nextStep(job, "Removing blocks...");
    count = yield* Jobs.perform(job, set(session, new Pattern("air")), false);
    Jobs.nextStep(job, "Pasting blocks...");
    yield* Jobs.perform(job, temp.loadProgressive(movedStart, dim), false);
    count += temp.getBlockCount();

    history.addRedoStructure(record, start, end, "any");
    history.addRedoStructure(record, movedStart, movedEnd, "any");
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
