import { assertCuboidSelection } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "minsel",
  description: "commands.wedit:minsel.description",
  permission: "worldedit.selection.minsel",
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

  const vec = Vector.ZERO;
  for (const axes of [["x", "y", "z"], ["y", "z", "x"], ["z", "x", "y"]] as ("x"|"y"|"z")[][]) {
    layers: for (const [layer, offset] of [[min, 1], [max, -1]] as [Vector, number][]) {
      do {
        vec[axes[0]] = layer[axes[0]];      
        for (vec[axes[1]] = min[axes[1]]; vec[axes[1]] <= max[axes[1]]; vec[axes[1]]++) {
          for (vec[axes[2]] = min[axes[2]]; vec[axes[2]] <= max[axes[2]]; vec[axes[2]]++) {
            if (mask.matchesBlock(dimension.getBlock(vec))) continue layers;
            yield;
          }
        }
        layer[axes[0]] += offset;
      } while (max[axes[0]] != min[axes[0]]);
      throw RawText.translate("commands.wedit:minsel.empty");
    }
  }

  session.selection.set(0, min);
  session.selection.set(1, max);

  return RawText.translate("commands.wedit:minsel.explain");
});
