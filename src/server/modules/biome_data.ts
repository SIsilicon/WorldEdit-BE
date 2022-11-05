import { Dimension, BlockLocation } from "@minecraft/server";
import { Database } from "@notbeer-api";
import { locToString, wrap } from "../util.js";

// TODO
class BiomeChanges {
  // map of subchunks; each subchunk is a map of biome changes
  private changes: Map<string, Map<string, number>> = new Map();

  constructor(public dimension: Dimension) {}

  setBiome(loc: BlockLocation, biome: number) {
    const subChunkCoord = locToString(new BlockLocation(
      Math.floor(loc.x / 16), Math.floor(loc.y / 16), Math.floor(loc.z / 16)
    ));

    if (!this.changes.has(subChunkCoord)) {
      this.changes.set(subChunkCoord, new Map());
    }
    const subChunk = this.changes.get(subChunkCoord);
    subChunk.set(locToString(new BlockLocation(wrap(16, loc.x), wrap(16, loc.y), wrap(16, loc.z))), biome);
  }

  flush() {
    for (const change in this.changes) {
      const tableName = this.dimension.id + "_" + change;
      const database = new Database(tableName);
      database.load();
      for (const biome of this.changes.get(change).entries()) {
        database.set(biome[0], biome[1]);
      }
      database.save();
    }
  }
}