import { registerCommand } from "../register_commands.js";
import { RawText, Vector } from "@notbeer-api";
import { assertClipboard } from "@modules/assert.js";
import { transformSelection } from "./transform_func.js";
import { FAST_MODE } from "@config.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
  name: "rotate",
  permission: "worldedit.region.rotate",
  description: "commands.wedit:rotate.description",
  usage: [
    {
      flag: "o"
    },
    {
      flag: "c"
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
      throw RawText.translate("commands.wedit:rotate.not-ninety").with(args.get("rotate"));
    } else if (rotation.x || rotation.z) {
      throw RawText.translate("commands.wedit:rotate.y-only");
    }
  }

  if (args.has("c")) {
    assertClipboard(session);
    if (!session.clipboard.isAccurate) assertValidFastArgs();

    if (!args.has("o")) {
      session.clipboardTransform.relative = session.clipboardTransform.relative.rotateY(args.get("rotate"));
    }
    session.clipboardTransform.rotation = session.clipboardTransform.rotation.add(rotation);
    blockCount = session.clipboard.getBlockCount();
  } else {
    if (FAST_MODE) assertValidFastArgs();

    const job = Jobs.startJob(session, 3, null); // TODO: Add ticking area
    yield* Jobs.perform(job, transformSelection(session, builder, args, {rotation}));
    Jobs.finishJob(job);
    blockCount = session.selection.getBlockCount();
  }

  return RawText.translate("commands.wedit:rotate.explain").with(blockCount);
});
