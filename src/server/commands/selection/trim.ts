import { assertCuboidSelection } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "trim",
  description: "commands.wedit:trim.description",
  permission: "worldedit.selection.trim",
  usage: [
    {
      name: "mask",
      type: "Mask",
      default: new Mask("#existing")
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const mask: Mask = args.get("mask");
  const [min, max] = session.selection.getRange();
  const dimension = builder.dimension;

  for (const axes of [["x", "y", "z"], ["y", "z", "x"], ["z", "x", "y"]] as ("x"|"y"|"z")[][]) {
    outer: for (const [start, end, sign] of [[min, max, 1], [max, min, -1]] as [Vector, Vector, number][]) {
      for (const vec = start.clone(); Math.sign(vec[axes[0]] - end[axes[0]]) != sign; vec[axes[0]] += sign) {
        start[axes[0]] = vec[axes[0]];
        for (vec[axes[1]] = min[axes[1]]; vec[axes[1]] <= max[axes[1]]; vec[axes[1]]++) {
          for (vec[axes[2]] = min[axes[2]]; vec[axes[2]] <= max[axes[2]]; vec[axes[2]]++) {
            if (mask.matchesBlock(dimension.getBlock(vec))) continue outer;
            yield;
          }
        }
      }
      throw RawText.translate("commands.wedit:trim.no-blocks");
    }
  }

  session.selection.set(0, min);
  session.selection.set(1, max);

  return RawText.translate("commands.wedit:trim.explain");
});
