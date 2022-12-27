import { Player } from "@minecraft/server";
import { assertCanBuildWithin, assertSelection } from "@modules/assert.js";
import { Biome, BiomeChanges } from "@modules/biome_data.js";
import { Jobs } from "@modules/jobs.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RawText, regionIterateBlocks, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "setbiome",
  permission: "worldedit.biome.set",
  description: "commands.wedit:setbiome.description",
  usage: [
    {
      name: "biome",
      type: "Biome"
    },
    {
      flag: "p"
    }
  ]
};

const users: Player[] = [];
registerCommand(registerInformation, function* (session, builder, args) {
  let changeCount = 0;
  const biome = (args.get("biome") as Biome).getId();
  const biomeChanges = new BiomeChanges(builder.dimension);

  if (args.has("p")) {
    biomeChanges.setBiome(PlayerUtil.getBlockLocation(builder), biome);
    biomeChanges.flush();
    changeCount++;
    yield;
  } else {
    assertSelection(session);
    assertCanBuildWithin(builder, ...session.selection.getRange());

    let i = 0;
    const blockCount = session.selection.getBlockCount();
    const job = (yield Jobs.startJob(session, 1, session.selection.getRange())) as number;
    try {
      Jobs.nextStep(job, "Setting biome data...");
      if (session.selection.isCuboid()) {
        const [min, max] = session.selection.getRange();
        const minSubChunk = Vector.from(min).mul(1/16).floor();
        const maxSubChunk = Vector.from(max).mul(1/16).floor();

        for (let subZ = minSubChunk.z; subZ <= maxSubChunk.z; subZ++) {
          for (let subY = minSubChunk.y; subY <= maxSubChunk.y; subY++) {
            for (let subX = minSubChunk.x; subX <= maxSubChunk.x; subX++) {
              const chunkMin = new Vector(subX, subY, subZ).mul(16).max(min);
              const chunkMax = new Vector(subX, subY, subZ).mul(16).add(15).min(max);

              for (const block of regionIterateBlocks(chunkMin.toBlock(), chunkMax.toBlock())) {
                biomeChanges.setBiome(block, biome);
                Jobs.setProgress(job, ++i / blockCount);
                changeCount++;
                yield;
              }
              biomeChanges.flush();
              yield;
            }
          }
        }
      } else {
        for (const block of session.selection.getBlocks()) {
          biomeChanges.setBiome(block, biome);
          Jobs.setProgress(job, ++i / blockCount);
          changeCount++;
          yield;
        }
        biomeChanges.flush();
        yield;
      }
    } finally {
      Jobs.finishJob(job);
    }
  }
  let message = RawText.translate("commands.wedit:setbiome.changed").with(changeCount);
  if (!users.includes(builder)) {
    message = message.append("text", "\n").append("translate", "commands.wedit:setbiome.warning");
    users.push(builder);
  }
  return message;
});
