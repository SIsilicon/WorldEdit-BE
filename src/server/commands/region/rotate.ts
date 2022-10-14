import { registerCommand } from "../register_commands.js";
import { RawText, Vector } from "@notbeer-api";
import { assertClipboard } from "@modules/assert.js";
import { transformSelection } from "./transform_func.js";
import { Jobs } from "@modules/jobs.js";
import config from "config.js";

const registerInformation = {
  name: "rotate",
  permission: "worldedit.region.rotate",
  description: "commands.wedit:rotate.description",
  usage: [
    {
      flag: "o"
    },
    {
      flag: "w"
    },
    {
      flag: "s"
    },
    {
      name: "rotate",
      type: "int"
    },
    {
      name: "rotateX",
      type: "int",
      default: 0
    },
    {
      name: "rotateZ",
      type: "int",
      default: 0
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  let blockCount = 0;
  const rotation = new Vector(args.get("rotateX"), args.get("rotate"), args.get("rotateZ"));
  function assertValidFastArgs () {
    if ((Math.abs(rotation.y) / 90) % 1 != 0) {
      throw RawText.translate("commands.wedit:rotate.notNinety").with(args.get("rotate"));
    } else if (rotation.x || rotation.z) {
      throw RawText.translate("commands.wedit:rotate.yOnly");
    }
  }

  if (args.has("w")) {
    if (config.fastMode || session.performanceMode) assertValidFastArgs();

    const job = (yield Jobs.startJob(session, 3, null)) as number; // TODO: Add ticking area
    yield* Jobs.perform(job, transformSelection(session, builder, args, {rotation}));
    Jobs.finishJob(job);
    blockCount = session.selection.getBlockCount();
  } else {
    assertClipboard(session);
    if (!session.clipboard.isAccurate) assertValidFastArgs();

    if (!args.has("o")) {
      session.clipboardTransform.relative = session.clipboardTransform.relative.rotateY(args.get("rotate"));
    }
    session.clipboardTransform.rotation = session.clipboardTransform.rotation.add(rotation);
    blockCount = session.clipboard.getBlockCount();
  }

  return RawText.translate("commands.wedit:rotate.explain").with(blockCount);
});
