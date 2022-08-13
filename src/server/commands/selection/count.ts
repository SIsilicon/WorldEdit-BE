import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "count",
  description: "commands.wedit:count.description",
  permission: "worldedit.analysis.count",
  usage: [
    {
      name: "mask",
      type: "Mask"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  let count = 0;
  const mask = args.get("mask") as Mask;
  const dimension = builder.dimension;

  const total = session.selection.getBlockCount();
  const job = Jobs.startJob(session, 1, session.selection.getRange());
  try {
    let i = 0;
    Jobs.nextStep(job, "Counting blocks...");
    for (const block of session.selection.getBlocks()) {
      count += mask.matchesBlock(block, dimension) ? 1 : 0;
      Jobs.setProgress(job, ++i / total);
      yield;
    }
  } finally {
    Jobs.finishJob(job);
  }
  return RawText.translate("commands.wedit:count.explain").with(count);
});
