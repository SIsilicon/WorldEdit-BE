import { assertClipboard, assertCanBuildWithin } from "@modules/assert";
import { Jobs } from "@modules/jobs.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionSize, regionTransformedBounds, Vector } from "@notbeer-api";
import { BlockLocation } from "@minecraft/server";
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
  const bounds = regionTransformedBounds(Vector.ZERO.toBlock(), session.clipboard.getSize().offset(-1, -1, -1), Vector.ZERO, rotation, flip);
  const size = Vector.from(regionSize(bounds[0], bounds[1]));

  let pasteStart: Vector | BlockLocation;
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
  const pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE)).toBlock();
  pasteStart = pasteStart.toBlock();

  const history = session.getHistory();
  const record = history.record();
  const job = Jobs.startJob(session, 1, [pasteStart, pasteEnd]);
  try {
    if (pasteContent) {
      assertCanBuildWithin(builder, pasteStart, pasteEnd);
      history.addUndoStructure(record, pasteStart, pasteEnd, "any");

      Jobs.nextStep(job, "Pasting blocks...");
      if (yield* Jobs.perform(job, session.clipboard.loadProgressive(pasteStart, builder.dimension, session.clipboardTransform))) {
        throw RawText.translate("commands.generic.wedit:commandFail");
      }

      history.addRedoStructure(record, pasteStart, pasteEnd, "any");
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
