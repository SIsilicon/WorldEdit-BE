import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText, regionBounds } from "@notbeer-api";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";
import { floodFill, FloodFillContext } from "./floodfill_func.js";

const registerInformation = {
  name: "fill",
  permission: "worldedit.utility.fill",
  description: "commands.wedit:fill.description",
  usage: [
    {
      name: "pattern",
      type: "Pattern"
    },
    {
      name: "radius",
      type: "float"
    },
    {
      name: "depth",
      type: "int",
      range: [1, null] as [number, null],
      default: 1
    },
    {
      name: "direction",
      type: "Direction",
      default: new Cardinal(Cardinal.Dir.DOWN)
    }
  ]
};

interface fillContext extends FloodFillContext {
    fillDown?: boolean
}

registerCommand(registerInformation, function* (session, builder, args) {
  // TODO: Assert Can Build within

  const dimension = builder.dimension;
  const fillDir = (args.get("direction") as Cardinal).getDirection(builder);
  const pattern: Pattern = args.get("pattern");
  pattern.playerSession = session;
  const depth: number = args.get("depth");
  const startBlock = session.getPlacementPosition();
  const job = Jobs.startJob(session, 1, new SphereShape(args.get("radius")).getRegion(startBlock));

  Jobs.nextStep(job, "Calculating and Generating blocks...");
  const blocks = yield* floodFill<fillContext>(startBlock, args.get("radius"), dimension, (ctx, dir) => {
    const dotDir = fillDir.dot(dir);

    if (dotDir < 0) return false;
    if (dotDir == 0 && ctx.fillDown) return false;
    if (fillDir.dot(ctx.pos.add(dir)) > depth-1) return false;
    if (!dimension.getBlock(ctx.worldPos.add(dir)).isAir()) return false;

    if (dotDir > 0) ctx.fillDown = true;
    return true;
  });

  if (blocks.length) {
    const [min, max] = regionBounds(blocks);

    const history = session.getHistory();
    const record = history.record();
    try {
      history.addUndoStructure(record, min, max, blocks);
      let i = 0;
      for (const block of blocks) {
        pattern.setBlock(builder.dimension.getBlock(block));
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
