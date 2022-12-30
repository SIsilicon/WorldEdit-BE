import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { RawText } from "@notbeer-api";
import { BlockLocation } from "@minecraft/server";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "center",
  permission: "worldedit.region.center",
  description: "commands.wedit:center.description",
  usage: [
    {
      name: "pattern",
      type: "Pattern"
    }
  ],
  aliases: ["middle"]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertSelection(session);
  if (args.get("_using_item") && session.globalPattern.empty()) {
    throw "worldEdit.selectionFill.noPattern";
  }

  const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

  const range = session.selection.getRange();
  const center = [
    (range[0].x + range[1].x) / 2,
    (range[0].y + range[1].y) / 2,
    (range[0].z + range[1].z) / 2
  ];

  const selection = {
    mode: session.selection.mode,
    points: session.selection.points
  }

  let count;
  try {
    session.selection.mode = "cuboid";
    session.selection.set(0, new BlockLocation(...center.map(Math.floor)));
    session.selection.set(1, new BlockLocation(...center.map(Math.ceil)));

    const [shape, loc] = session.selection.getShape();
    const job = (yield Jobs.startJob(session, 2, session.selection.getRange())) as number;
    count = yield* Jobs.perform(job, shape.generate(loc, pattern, null, session));
    Jobs.finishJob(job);

  } finally {
    session.selection.mode = selection.mode;
    session.selection.set(0, selection.points[0]);
    session.selection.set(1, selection.points[1]);
  }

  return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
