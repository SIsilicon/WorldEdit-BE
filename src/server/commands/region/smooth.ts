import { assertSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { smooth } from "./smooth_func.js";

const registerInformation = {
  name: "smooth",
  permission: "worldedit.region.smooth",
  description: "commands.wedit:smooth.description",
  usage: [
    {
      name: "iterations",
      type: "int",
      range: [1, null] as [number, null],
      default: 1
    },
    {
      name: "mask",
      type: "Mask",
      default: new Mask()
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());

  const [shape, loc] = session.selection.getShape();
  const job = Jobs.startJob(session, 2 + args.get("iterations") * 2, session.selection.getRange());
  const count = yield* Jobs.perform(job, smooth(session, args.get("iterations"), shape, loc, args.get("mask"), null));

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
