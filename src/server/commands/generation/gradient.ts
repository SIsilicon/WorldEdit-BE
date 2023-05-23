import { RawText, regionSize } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";
import { Vector3 } from "@minecraft/server";

const registerInformation = {
  name: "gradient",
  permission: "worldedit.generation.gradient",
  description: "commands.wedit:gradient.description",
  usage: [
    {
      flag: "s"
    },
    {
      flag: "f",
      name: "fade",
      type: "float",
      range: [0, 1] as [number, number]
    },
    {
      name: "id",
      type: "string"
    },
    {
      name: "patterns",
      type: "Pattern..."
    },
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  const patterns = [];
  if (args.has("s")) {
    assertCuboidSelection(session);
    const [min, max] = session.selection.getRange();
    const size = regionSize(min, max);
    const dim = builder.dimension;
    type axis = "x" | "y" | "z";
    let s: axis, t: axis, u: axis;
    if (size.x > size.y && size.x > size.z) {
      s = "y"; t = "z"; u = "x";
    } else if (size.z > size.x && size.z > size.y) {
      s = "x"; t = "y"; u = "z";
    } else {
      s = "x"; t = "z"; u = "y";
    }

    for (let i = min[u]; i <= max[u]; i++) {
      const pattern = new Pattern();
      for (let j = min[s]; j <= max[s]; j++) {
        for (let k = min[t]; k <= max[t]; k++) {
          pattern.addBlock(dim.getBlock({ [s]: j, [t]: k, [u]: i } as unknown as Vector3).permutation);
        }
      }
      patterns.push(pattern);
    }
  } else {
    patterns.push(...(args.get("patterns") ?? []));
  }

  session.createGradient(args.get("id"), args.get("f-fade") ?? 1.0, patterns);
  return RawText.translate("commands.wedit:gradient.create").with(args.get("id"));
});
