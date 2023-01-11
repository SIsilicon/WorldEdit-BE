import { assertCuboidSelection, assertCanBuildWithin } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { RawText, Vector } from "@notbeer-api";
import { BlockLocation, MinecraftBlockTypes } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";
import config from "config.js";

const registerInformation = {
  name: "copy",
  permission: "worldedit.clipboard.copy",
  description: "commands.wedit:copy.description",
  usage: [
    {
      flag: "a"
    }, {
      flag: "e"
    }, {
      flag: "m",
      name: "mask",
      type: "Mask"
    }
  ]
};

/**
 * Performs the ;copy command.
 * @remark This function is only exported so as to not duplicate code for the ;cut command.
 * @param session The session whose player is running this command
 * @param args The arguments that change how the copying will happen
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* copy(session: PlayerSession, args = new Map<string, any>()): Generator<number | string | Promise<unknown>, boolean> {
  assertCuboidSelection(session);
  const player = session.getPlayer();
  const dimension = player.dimension;
  const [start, end] = session.selection.getRange();
  assertCanBuildWithin(player, start, end);

  const usingItem = args.get("_using_item");
  const includeEntities: boolean = usingItem ? session.includeEntities : args.has("e");
  const includeAir: boolean = usingItem ? session.includeAir : !args.has("a");
  const mask: Mask = usingItem ? Mask.clone(session.globalMask) : (args.has("m") ? args.get("m-mask") : undefined);

  if (session.clipboard) {
    session.deleteRegion(session.clipboard);
  }

  session.clipboard = session.createRegion(!config.performanceMode && !session.performanceMode);
  session.clipboardTransform = {
    rotation: Vector.ZERO,
    flip: Vector.ONE,
    originalLoc: Vector.add(start, end).mul(0.5),
    originalDim: player.dimension.id,
    relative: Vector.sub(Vector.add(start, end).mul(0.5), Vector.from(player.location).floor())
  };

  let error = false;

  if (session.clipboard.isAccurate) {
    const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
    const filter = mask || !includeAir;

    yield "Copying blocks...";
    const blocks = (loc: BlockLocation) => {
      const wasAir = dimension.getBlock(loc).typeId == "minecraft:air";
      const isAir = wasAir || (mask ? !mask.matchesBlock(loc, dimension) : false);
      if (includeAir && mask && !wasAir && isAir) {
        return airBlock;
      } else if (!includeAir && isAir) {
        return false;
      }
      return true;
    };
    error = yield* session.clipboard.saveProgressive(start, end, dimension, { includeEntities }, filter ? blocks : "all");
  } else {
    error = (yield session.clipboard.save(start, end, dimension, {includeEntities})) as boolean;
  }

  return error;
}

registerCommand(registerInformation, function* (session, builder, args) {
  assertCuboidSelection(session);
  const job = (yield Jobs.startJob(session, 1, session.selection.getRange())) as number;
  try {
    if (yield* Jobs.perform(job, copy(session, args))) {
      throw RawText.translate("commands.generic.wedit:commandFail");
    }
  } finally {
    Jobs.finishJob(job);
  }
  return RawText.translate("commands.wedit:copy.explain").with(`${session.clipboard.getBlockCount()}`);
});
