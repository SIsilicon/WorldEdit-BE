import { assertSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "set",
  permission: "worldedit.region.set",
  description: "commands.wedit:set.description",
  usage: [
    {
      name: "pattern",
      type: "Pattern"
    }
  ]
};

/**
 * Set a region of blocks regardless of the current global mask
 * @return number of blocks set
 */
export function* set(session: PlayerSession, pattern: Pattern, mask?: Mask, recordHistory = false): Generator<string | number, number> {
  const globalMask = session.globalMask;
  let changed = 0;
  try {
    session.globalMask = null;
    const [shape, loc] = session.selection.getShape();
    changed = yield* shape.generate(loc, pattern, mask, session, {recordHistory});
  } finally {
    session.globalMask = globalMask;
  }
  return changed;
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  assertCanBuildWithin(builder, ...session.selection.getRange());
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw RawText.translate("worldEdit.selectionFill.noPattern");
  }

  const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

  const job = Jobs.startJob(session, 2, session.selection.getRange());
  const count = yield* Jobs.perform(job, set(session, pattern, null, true));
  Jobs.finishJob(job);
  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
