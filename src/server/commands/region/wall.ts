import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "walls",
  permission: "worldedit.region.walls",
  description: "commands.wedit:wall.description",
  usage: [
    {
      name: "pattern",
      type: "Pattern"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw RawText.translate("worldEdit.selectionFill.noPattern");
  }

  const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

  const [shape, loc] = session.selection.getShape();
  const job = (yield Jobs.startJob(session, 2, shape.getRegion(loc))) as number;
  const count = yield* Jobs.perform(job, shape.generate(loc, pattern, null, session, {wall: true}));
  Jobs.finishJob(job);

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
