import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, Vector } from "@notbeer-api";
import { CuboidShape } from "../../shapes/cuboid.js";
import { getWorldHeightLimits } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "removeabove",
  permission: "worldedit.utility.removeabove",
  description: "commands.wedit:removeabove.description",
  usage: [
    {
      name: "size",
      type: "int"
    },
    {
      name: "height",
      type: "int",
      range: [1, null] as [number, null],
      default: -1
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  // TODO: Assert Can Build within

  const size = (args.get("size") - 1) * 2 + 1;
  const height: number = args.get("height") == -1 ? getWorldHeightLimits(builder.dimension)[1] - Math.floor(builder.location.y) + 1 : args.get("height");
  const origin = Vector.from(builder.location).floor().sub([size/2, 0, size/2]).ceil().toBlock();

  const shape = new CuboidShape(size, height, size);
  const job = (yield Jobs.startJob(session, 2, shape.getRegion(origin))) as number;
  const count = yield* Jobs.perform(job, shape.generate(origin, new Pattern("air"), null, session, {ignoreGlobalMask: true}));
  Jobs.finishJob(job);

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
