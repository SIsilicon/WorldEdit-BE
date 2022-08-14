import { registerCommand } from "../register_commands.js";
import { assertClipboard } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { RawText, Vector } from "@notbeer-api";
import { transformSelection } from "./transform_func.js";
import { FAST_MODE } from "@config.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
  name: "flip",
  permission: "worldedit.region.flip",
  description: "commands.wedit:flip.description",
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
      name: "direction",
      type: "Direction",
      default: new Cardinal(Cardinal.Dir.LEFT)
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  const dir: Vector = args.get("direction").getDirection(builder);
  const flip = Vector.ONE;
  if (dir.x) flip.x *= -1;
  if (dir.y) flip.y *= -1;
  if (dir.z) flip.z *= -1;

  let blockCount = 0;
  if (args.has("w")) {
    if (dir.y != 0 && FAST_MODE) {
      throw "commands.wedit:flip.notLateral";
    }

    const job = Jobs.startJob(session, 3, null); // TODO: Add ticking area
    yield* Jobs.perform(job, transformSelection(session, builder, args, {flip}));
    Jobs.finishJob(job);
    blockCount = session.selection.getBlockCount();
  } else {
    assertClipboard(session);
    if (dir.y != 0 && !session.clipboard.isAccurate) {
      throw "commands.wedit:flip.notLateral";
    }

    const clipTrans = session.clipboardTransform;
    if (!args.has("o")) {
      if (Math.abs(dir.x)) {
        clipTrans.relative.x *= -1;
      } else if (Math.abs(dir.z)) {
        clipTrans.relative.z *= -1;
      }
    }

    clipTrans.flip = clipTrans.flip.mul(flip);
    blockCount = session.clipboard.getBlockCount();
  }

  return RawText.translate("commands.wedit:flip.explain").with(blockCount);
});
