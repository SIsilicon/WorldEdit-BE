import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, Vector } from "@notbeer-api";
import { BlockPermutation } from "@minecraft/server";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions, lavaMatch } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation = {
  name: "fixlava",
  permission: "worldedit.utility.fixlava",
  description: "commands.wedit:fixlava.description",
  usage: [
    {
      name: "radius",
      type: "float"
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  // TODO: Assert Can Build within

  const dimension = builder.dimension;
  const playerBlock = session.getPlacementPosition();
  let fixlavaStart: Vector;
  for (const offset of fluidLookPositions) {
    const loc = playerBlock.offset(offset.x, offset.y, offset.z);
    const block = dimension.getBlock(loc);
    if (block.typeId.match(lavaMatch)) {
      fixlavaStart = loc;
      break;
    }
  }

  if (!fixlavaStart) {
    throw "commands.wedit:fixlava.noLava";
  }

  const job = Jobs.startJob(session, 1, new SphereShape(args.get("radius")).getRegion(fixlavaStart));
  Jobs.nextStep(job, "Calculating and Fixing lava...");
  const blocks = yield* floodFill(fixlavaStart, args.get("radius"), dimension, (ctx, dir) => {
    const block = dimension.getBlock(ctx.worldPos.offset(dir.x, dir.y, dir.z));
    if (!block.typeId.match(lavaMatch)) return false;
    return true;
  });

  if (blocks.length) {
    const [min, max] = regionBounds(blocks);

    const history = session.getHistory();
    const record = history.record();
    const lava = BlockPermutation.resolve("minecraft:lava");
    try {
      history.addUndoStructure(record, min, max, blocks);
      let i = 0;
      for (const loc of blocks) {
        const block = dimension.getBlock(loc);
        block.setPermutation(lava);
        Jobs.setProgress(job, i++ / blocks.length);
        yield;
      }
      history.addRedoStructure(record, min, max, blocks);
      history.commit(record);
    } catch (err) {
      history.cancel(record);
      throw err;
    } finally {
      Jobs.finishJob(job);
    }
  } else {
    Jobs.finishJob(job);
  }

  return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.length}`);
});
