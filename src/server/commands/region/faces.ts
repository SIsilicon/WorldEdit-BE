import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "faces",
  permission: "worldedit.region.faces",
  description: "commands.wedit:faces.description",
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
  const job = Jobs.startJob(session, 2, session.selection.getRange());
  const count = yield* Jobs.perform(job, shape.generate(loc, pattern, null, session, {hollow: true}));
  Jobs.finishJob(job);

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
