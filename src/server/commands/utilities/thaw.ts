import { Jobs } from "@modules/jobs.js";
import { RawText, Vector } from "@notbeer-api";
import { Block, Vector3, MinecraftBlockTypes, Vector as MCVector } from "@minecraft/server";
import { getWorldHeightLimits } from "../../util.js";
import { CylinderShape } from "../../shapes/cylinder.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "thaw",
  permission: "worldedit.utility.thaw",
  description: "commands.wedit:thaw.description",
  usage: [
    {
      name: "size",
      type: "int",
      range: [1, null] as [number, null]
    },
    {
      name: "height",
      type: "int",
      range: [1, null] as [number, null],
      default: -1
    }
  ]
};

registerCommand(registerInformation, function* (session, builder, args) {
  // TODO: Assert Can Build within

  const dimension = builder.dimension;
  const radius: number = args.get("size");
  const height: number = args.get("height") < 0 ? 4096 : (args.get("height") - 1) * 2 + 1;
  const origin = Vector.from(builder.location).floor();

  const shape = new CylinderShape(height, radius);
  const range = shape.getRegion(origin);
  const heightLimits = getWorldHeightLimits(dimension);
  range[0].y = Math.max(range[0].y, heightLimits[0]);
  range[1].y = Math.min(range[1].y, heightLimits[1]);

  const job = (yield Jobs.startJob(session, 2, range)) as number;
  const history = session.getHistory();
  const record = history.record();
  try {
    Jobs.nextStep(job, "Raycasting..."); // TODO: Localize
    let i = 0;

    const blocks: Block[] = [];
    const blockLocs: Vector3[] = [];
    const affectedBlockRange: [Vector3, Vector3] = [null, null];
    const area = (range[1].x - range[0].x + 1) * (range[1].z - range[0].x + 1);

    const rayTraceOptions = {
      includeLiquidBlocks: true,
      includePassableBlocks: true,
      maxDistance: height
    };

    for (let x = range[0].x; x <= range[1].x; x++)
      for (let z = range[0].z; z <= range[1].z; z++) {
        const yRange = shape.getYRange(x - origin.x, z - origin.z)?.map(y => y + origin.y) as [number, number];
        if (!yRange) {
          i++;
          continue;
        }

        const loc = new Vector(x + 0.5, yRange[1] + 1.01, z + 0.5);
        try {
          const block = dimension.getBlockFromRay(loc, MCVector.down, rayTraceOptions);
          if (block) {
            blocks.push(block);
            blockLocs.push(block.location);

            if (affectedBlockRange[0]) {
              affectedBlockRange[0] = Vector.from(affectedBlockRange[0]).min(block.location).floor();
              affectedBlockRange[1] = Vector.from(affectedBlockRange[1]).max(block.location).floor();
            } else {
              affectedBlockRange[0] = block.location;
              affectedBlockRange[1] = block.location;
            }
          }
        // eslint-disable-next-line no-empty
        } catch {}

        Jobs.setProgress(job, i / area);
        i++;
        yield;
      }

    Jobs.nextStep(job, "Generating blocks..."); // TODO: Localize
    let changed = 0;
    i = 0;

    if (blocks.length) {
      yield history.addUndoStructure(record, affectedBlockRange[0], affectedBlockRange[1], blockLocs);
      const air = MinecraftBlockTypes.air.createDefaultBlockPermutation();
      const water = MinecraftBlockTypes.water.createDefaultBlockPermutation();

      for (const block of blocks) {
        if (block.typeId == "minecraft:ice") {
          block.setPermutation(water);
          changed++;
        } else if (block.typeId == "minecraft:snow_layer") {
          block.setPermutation(air);
          changed++;
        }

        Jobs.setProgress(job, i++ / blocks.length);
        yield;
      }
      yield history.addRedoStructure(record, affectedBlockRange[0], affectedBlockRange[1], blockLocs);
    }

    return RawText.translate("commands.blocks.wedit:changed").with(`${changed}`);
  } catch (err) {
    history.cancel(record);
    throw err;
  } finally {
    history.commit(record);
    Jobs.finishJob(job);
  }
});
