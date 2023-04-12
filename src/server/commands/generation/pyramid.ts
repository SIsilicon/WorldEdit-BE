import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText } from "@notbeer-api";
import { PyramidShape } from "../../shapes/pyramid.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "pyramid",
  permission: "worldedit.generation.pyramid",
  description: "commands.wedit:pyramid.description",
  usage: [
    {
      flag: "h"
    }, {
      name: "pattern",
      type: "Pattern"
    }, {
      name: "size",
      type: "int",
      range: [1, null] as [number, null]
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  const pattern: Pattern = args.get("pattern");
  const isHollow = args.has("h");
  const size: number = args.get("size");

  const loc = PlayerUtil.getBlockLocation(builder);
  const pyramidShape = new PyramidShape(size);
  const job = (yield Jobs.startJob(session, 2, pyramidShape.getRegion(loc))) as number;
  const count = yield* Jobs.perform(job, pyramidShape.generate(loc, pattern, null, session, {"hollow": isHollow}));
  Jobs.finishJob(job);

  return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
