import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { RawText } from "@notbeer-api";
import { Vector } from "@notbeer-api";
import { BlockLocation } from "mojang-minecraft";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "line",
  permission: "worldedit.region.line",
  description: "commands.wedit:line.description",
  usage: [
    {
      name: "pattern",
      type: "Pattern"
    }
  ]
};

function* bresenham3d(p1: Vector, p2: Vector): Generator<void, Vector[]> {
  const pointList: Vector[] = [];
  pointList.push(p1.clone());
  const d = p2.sub(p1).abs();
  const s = Vector.ZERO;

  s.x = p2.x > p1.x ? 1 : -1;
  s.y = p2.y > p1.y ? 1 : -1;
  s.z = p2.z > p1.z ? 1 : -1;

  // Driving axis is X-axis
  if (d.x >= d.y && d.x >= d.z) {
    let sub1 = 2 * d.y - d.x;
    let sub2 = 2 * d.z - d.x;
    while (p1.x != p2.x) {
      p1 = p1.clone();
      p1.x += s.x;
      if (sub1 >= 0) {
        p1.y += s.y;
        sub1 -= 2 * d.x;
      }
      if (sub2 >= 0) {
        p1.z += s.z;
        sub2 -= 2 * d.x;
      }
      sub1 += 2 * d.y;
      sub2 += 2 * d.z;
      pointList.push(p1);
      yield;
    }
  }
  // Driving axis is Y-axis
  else if (d.y >= d.x && d.y >= d.z) {
    let sub1 = 2 * d.x - d.y;
    let sub2 = 2 * d.z - d.y;
    while (p1.y != p2.y) {
      p1 = p1.clone();
      p1.y += s.y;
      if (sub1 >= 0) {
        p1.x += s.x;
        sub1 -= 2 * d.y;
      }
      if (sub2 >= 0) {
        p1.z += s.z;
        sub2 -= 2 * d.y;
      }
      sub1 += 2 * d.x;
      sub2 += 2 * d.z;
      pointList.push(p1);
      yield;
    }
  }
  // Driving axis is Z-axis
  else {
    let sub1 = 2 * d.y - d.z;
    let sub2 = 2 * d.x - d.z;
    while (p1.z != p2.z) {
      p1 = p1.clone();
      p1.z += s.z;
      if (sub1 >= 0) {
        p1.y += s.y;
        sub1 -= 2 * d.z;
      }
      if (sub2 >= 0) {
        p1.x += s.x;
        sub2 -= 2 * d.z;
      }
      sub1 += 2 * d.y;
      sub2 += 2 * d.x;
      pointList.push(p1);
      yield;
    }
  }

  return pointList;
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());
  if (session.selection.mode != "cuboid") {
    throw "commands.wedit:line.invalidType";
  }
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw "worldEdit.selectionFill.noPattern";
  }

  const dim = builder.dimension;
  const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

  let pos1: BlockLocation, pos2: BlockLocation, start: BlockLocation, end: BlockLocation;
  if (session.selection.mode == "cuboid") {
    [pos1, pos2] = session.selection.points;
    [start, end] = session.selection.getRange();
  }

  const history = session.getHistory();
  const record = history.record();
  let count: number;
  try {
    const points = (yield* bresenham3d(Vector.from(pos1), Vector.from(pos2))).map(p => p.toBlock());
    // TODO: sort line blocks as if it came from regionIterateBlocks.
    history.addUndoStructure(record, start, end);
    count = 0;
    for (const point of points) {
      if (session.globalMask.matchesBlock(point, dim) && !pattern.setBlock(point, dim)) {
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
