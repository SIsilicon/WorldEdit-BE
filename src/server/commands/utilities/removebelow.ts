import { Pattern } from "@modules/pattern.js";
import { RawText, Vector } from "@notbeer-api";
import { CuboidShape } from "../../shapes/cuboid.js";
import { getWorldMinY } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "removebelow",
  permission: "worldedit.utility.removebelow",
  description: "commands.wedit:removebelow.description",
  usage: [
    {
      name: "size",
      type: "int"
    },
    {
      name: "depth",
      type: "int",
      range: [1, null] as [number, null],
      default: -1
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  // TODO: Assert Can Build within

  const size = (args.get("size") - 1) * 2 + 1;
  const depth: number = args.get("depth") == -1 ? Math.floor(builder.location.y) - getWorldMinY(builder) + 1 : args.get("depth");
  const origin = Vector.from(builder.location).floor().sub([size/2, depth - 1, size/2]).ceil().toBlock();

  const shape = new CuboidShape(size, depth, size);
  const sessionMask = session.globalMask;
  try {
    session.globalMask = null;
    const count = yield* shape.generate(origin, new Pattern("air"), null, session);
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
  } finally {
    session.globalMask = sessionMask;
  }
});
