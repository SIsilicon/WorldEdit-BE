import { Dimension, Vector3 } from "@minecraft/server";
import { assertSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { Server, RawText, Vector } from "@notbeer-api";
import { locToString, stringToLoc } from "server/util.js";
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

function* hollow(dim: Dimension, blocks: Generator<Vector3>, start: Vector3, end: Vector3, thickness: number) {
  const pointSet: Set<string> = new Set();
  for (const loc of blocks) {
    pointSet.add(locToString(loc));
  }

  const recurseDirections: Vector[] = [
    new Vector(0, 1, 0),
    new Vector(0, -1, 0),
    new Vector(0, 0, -1),
    new Vector(0, 0, 1),
    new Vector(1, 0, 0),
    new Vector(-1, 0, 0)
  ];

  function* recurseHollow(origin: Vector): Generator {
    const queue: Vector[] = [origin];
    while (queue.length != 0) {
      const loc = queue.shift();
      const locString = locToString(loc);
      if (!pointSet.has(locString) || !Server.block.isAirOrFluid(dim.getBlock(loc).permutation)) {
        yield;
        continue;
      }
      pointSet.delete(locString);
      for (const recurseDirection of recurseDirections) {
        queue.push(loc.add(recurseDirection));
      }
      yield;
    }
  }

  for (let x = start.x; x <= end.x; x++) {
    for (let y = start.y; y <= end.y; y++) {
      yield* recurseHollow(new Vector(x, y, start.z));
      yield* recurseHollow(new Vector(x, y, end.z));
    }
  }
  for (let y = start.y; y <= end.y; y++) {
    for (let z = start.z; z <= end.z; z++) {
      yield* recurseHollow(new Vector(start.x, y, z));
      yield* recurseHollow(new Vector(end.x, y, z));
    }
  }
  for (let z = start.z; z <= end.z; z++) {
    for (let x = start.x; x <= end.x; x++) {
      yield* recurseHollow(new Vector(x, start.y, z));
      yield* recurseHollow(new Vector(x, end.y, z));
    }
  }

  for (let i = 1; i <= thickness; i++) {
    const surface = [];
    outer: for (const point of pointSet) {
      for (const recurseDirection of recurseDirections) {
        if (!pointSet.has(locToString(stringToLoc(point).add(recurseDirection)))) {
          surface.push(point);
          yield;
          continue outer;
        }
      }
      yield;
    }
    surface.forEach(point => pointSet.delete(point));
    yield;
  }

  return pointSet;
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw RawText.translate("worldEdit.selectionFill.noPattern");
  }

  const dim = builder.dimension;
  const pattern: Pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");
  const thickness = args.get("thickness") as number;

  const blocks: Generator<Vector3> = session.selection.getBlocks();
  const [start, end]: [Vector3, Vector3] = session.selection.getRange();

  const history = session.getHistory();
  const record = history.record();
  let count: number;
  try {
    const pointSet = (yield* hollow(dim, blocks, start, end, thickness));
    history.addUndoStructure(record, start, end);
    count = 0;
    for (const locString of pointSet) {
      const block = dim.getBlock(stringToLoc(locString));
      if (session.globalMask.matchesBlock(block) && pattern.setBlock(block)) {
        count++;
      }
      yield;
    }

    history.recordSelection(record, session);
    history.addRedoStructure(record, start, end);
    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  }

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);    
});
