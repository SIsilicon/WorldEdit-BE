import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, Vector } from "@notbeer-api";
import { BlockLocation, MinecraftBlockTypes } from "mojang-minecraft";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";
import { fluidLookPositions, waterMatch } from "./drain.js";
import { floodFill } from "./floodfill_func.js";

const registerInformation = {
  name: "fixwater",
  permission: "worldedit.utility.fixwater",
  description: "commands.wedit:fixwater.description",
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
  const playerBlock = Vector.from(builder.location).toBlock();
  let fixwaterStart: BlockLocation;
  for (const offset of fluidLookPositions) {
    const loc = playerBlock.offset(offset.x, offset.y, offset.z);
    const block = dimension.getBlock(loc);
    if (block.id.match(waterMatch)) {
      fixwaterStart = loc;
      break;
    }
  }

  if (!fixwaterStart) {
    throw "commands.wedit:fixWater.noWater";
  }

  const job = Jobs.startJob(session, 1, new SphereShape(args.get("radius")).getRegion(fixwaterStart));
  Jobs.nextStep(job, "Calculating and Fixing water...");
  const blocks = yield* floodFill(fixwaterStart, args.get("radius"), dimension, (ctx, dir) => {
    const block = dimension.getBlock(ctx.worldPos.offset(dir.x, dir.y, dir.z));
    if (!block.id.match(waterMatch)) return false;
    return true;
  });

  if (blocks.length) {
    const [min, max] = regionBounds(blocks);

    const history = session.getHistory();
    const record = history.record();
    const water = MinecraftBlockTypes.water.createDefaultBlockPermutation();
    try {
      history.addUndoStructure(record, min, max, blocks);
      let i = 0;
      for (const loc of blocks) {
        const block = dimension.getBlock(loc);
        block.setPermutation(water);
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
