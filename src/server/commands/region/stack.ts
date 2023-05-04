import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, regionSize, regionVolume, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { copy } from "../clipboard/copy.js";
import { Vector3 } from "@minecraft/server";

const registerInformation = {
  name: "stack",
  permission: "worldedit.region.stack",
  description: "commands.wedit:stack.description",
  usage: [
    {
      flag: "a"
    }, {
      flag: "e"
    }, {
      flag: "r"
    }, {
      flag: "s"
    }, {
      name: "count",
      type: "int",
      range: [1, null] as [number, null],
      default: 1
    }, {
      name: "offset",
      type: "Direction",
      default: new Cardinal()
    }, {
      flag: "m",
      name: "mask",
      type: "Mask"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const amount = args.get("count");
  const [start, end] = session.selection.getRange();
  const dim = builder.dimension;
  const size = regionSize(start, end);

  const dir = args.get("offset").getDirection(builder).mul(args.has("r") ? 1 : size);
  let loadStart = start.offset(dir.x, dir.y, dir.z);
  let loadEnd = end.offset(dir.x, dir.y, dir.z);
  let count = 0;

  const loads: [Vector, Vector][] = [];
  const points: Vector3[] = [];
  for (let i = 0; i < amount; i++) {
    loads.push([loadStart, loadEnd]);
    points.push(loadStart, loadEnd);
    loadStart = loadStart.offset(dir.x, dir.y, dir.z);
    loadEnd = loadEnd.offset(dir.x, dir.y, dir.z);
  }
  const stackRegion = regionBounds(points);
  assertCanBuildWithin(builder, stackRegion[0], stackRegion[1]);

  const history = session.getHistory();
  const record = history.record();
  const tempStack = session.createRegion(true);
  const job = Jobs.startJob(session, loads.length + 1, stackRegion);

  // TODO: Record selection

  try {
    yield* Jobs.perform(job, copy(session, args, tempStack), false);

    history.addUndoStructure(record, ...stackRegion, "any");
    Jobs.nextStep(job, "Pasting blocks...");
    for (const load of loads) {
      yield* Jobs.perform(job, tempStack.loadProgressive(load[0], dim), false);
      count += regionVolume(load[0], load[1]);
    }
    history.addRedoStructure(record, ...stackRegion, "any");
    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  } finally {
    session.deleteRegion(tempStack);
    Jobs.finishJob(job);
  }

  if (args.has("s")) {
    session.selection.set(0, loads[loads.length - 1][0]);
    session.selection.set(1, loads[loads.length - 1][1]);
  }

  return RawText.translate("commands.wedit:stack.explain").with(count);
});
