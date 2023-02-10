import { assertClipboard, assertCanBuildWithin } from "@modules/assert";
import { Jobs } from "@modules/jobs.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionSize, regionTransformedBounds, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "paste",
  permission: "worldedit.clipboard.paste",
  description: "commands.wedit:paste.description",
  usage: [
    {
      flag: "o"
    }, {
      flag: "s"
    }, {
      flag: "n"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  assertClipboard(session);

  const setSelection = args.has("s") || args.has("n");
  const pasteOriginal = args.has("o");
  const pasteContent = !args.has("n");

  const rotation = session.clipboardTransform.rotation;
  const flip = session.clipboardTransform.flip;
  const bounds = regionTransformedBounds(Vector.ZERO.floor(), session.clipboard.getSize().offset(-1, -1, -1), Vector.ZERO, rotation, flip);
  const size = Vector.from(regionSize(bounds[0], bounds[1]));

  let pasteStart: Vector;
  if (pasteOriginal) {
    if (session.clipboardTransform.originalDim != builder.dimension.id || !session.clipboardTransform.originalLoc) {
      throw "commands.wedit:paste.noOriginal";
    }
    pasteStart = session.clipboardTransform.originalLoc;
  } else {
    const loc = PlayerUtil.getBlockLocation(builder);
    pasteStart = Vector.add(loc, session.clipboardTransform.relative);
  }
  pasteStart = pasteStart.sub(size.mul(0.5).sub(1));
  const pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE)).floor();
  pasteStart = pasteStart.floor();

  const history = session.getHistory();
  const record = history.record();
  const job = (yield Jobs.startJob(session, 1, [pasteStart, pasteEnd])) as number;
  try {
    if (pasteContent) {
      assertCanBuildWithin(builder, pasteStart, pasteEnd);
      yield history.addUndoStructure(record, pasteStart, pasteEnd, "any");

      Jobs.nextStep(job, "Pasting blocks...");
      yield* Jobs.perform(job, session.clipboard.loadProgressive(pasteStart, builder.dimension, session.clipboardTransform));
      yield history.addRedoStructure(record, pasteStart, pasteEnd, "any");
    }

    if (setSelection) {
      session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
      session.selection.set(0, pasteStart);
      session.selection.set(1, pasteEnd);
      history.recordSelection(record, session);
    }

    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  } finally {
    Jobs.finishJob(job);
  }

  if (pasteContent) {
    return RawText.translate("commands.wedit:paste.explain").with(`${session.clipboard.getBlockCount()}`);
  }
  return "";
});
