import { Dimension, Vector3, world, Entity } from "@minecraft/server";
import { commandSyntaxError, contentLog, CustomArgType, Database, Vector } from "@notbeer-api";
import { EventEmitter } from "library/classes/eventEmitter.js";
import { locToString, wrap } from "../util.js";
import { errorEventSym, PooledResource, readyEventSym, ResourcePool } from "./extern/resource_pools.js";


class Biome implements CustomArgType {
    private id = -1;
    private name = "unknown";

    constructor(id = "") {
        if (Number.parseInt(id) < 0) return;
        if (id) {
            const obj = Biome.parseArgs([id]).result;
            this.id = obj.id;
            this.name = obj.name;
        }
    }

    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    static parseArgs(args: string[], index = 0) {
        const input = args[index];
        const result = new Biome();
        if (!input) {
            return { result, argIndex: index + 1 };
        }

        if (input in nameToId) {
            result.name = input;
            result.id = nameToId[input as keyof typeof nameToId];
        } else if (Number.parseInt(input) in idToName) {
            const num = Number.parseInt(input);
            result.id = num;
            result.name = idToName[num as keyof typeof idToName];
        } else {
            const err: commandSyntaxError = {
                isSyntaxError: true,
                stack: contentLog.stack(),
                idx: index
            };
            throw err;
        }
        return { result, argIndex: index + 1 };
    }

    static clone(original: Biome) {
        const clone = new Biome();
        clone.id = original.id;
        clone.name = original.name;
        return clone;
    }

    toString() {
        return `[biome: ${this.name}/${this.id}]`;
    }
}

class BiomeChanges {
    // map of subchunks; each subchunk is a map of biome changes
    private changes: Map<string, Map<number, number>> = new Map();

    constructor(public dimension: Dimension) {}

    setBiome(loc: Vector3, biome: number) {
        const subChunkCoord = locToString(new Vector(
            Math.floor(loc.x / 16), Math.floor(loc.y / 16), Math.floor(loc.z / 16)
        ));

        if (!this.changes.has(subChunkCoord)) {
            this.changes.set(subChunkCoord, new Map());
        }
        const subChunk = this.changes.get(subChunkCoord);
        subChunk.set(this.locToId(new Vector(wrap(16, loc.x), wrap(16, loc.y), wrap(16, loc.z))), biome);

        if (subChunk.size == 4096) {
            this.flush();
        }
    }

    flush() {
        for (const [chunk, data] of this.changes) {
            const tableName = `biome,${this.dimension.id},${chunk}`;
            const database = new Database(tableName);

            let biomes: number[] = [];
            if (!database.has("biomes")) {
                biomes.length = 4096;
                biomes = biomes.fill(-1);
            } else {
                const palette: number[] = database.get("palette");
                biomes = (database.get("biomes") as number[]).map(idx => idx ? palette[idx - 1] : -1);
            }

            for (const [loc, biome] of data.entries()) {
                biomes[loc] = biome;
            }

            const paletteMap = new Map<number, number>();
            for (const biome of biomes) {
                if (biome >= 0) {
                    paletteMap.set(biome, null);
                }
            }
            const newPalette = Array.from(paletteMap.keys());
            paletteMap.clear();
            newPalette.forEach((val, idx) => paletteMap.set(val, idx + 1));
            paletteMap.set(-1, 0);

            database.set("biomes", biomes.map(biome => paletteMap.get(biome)));
            database.set("palette", newPalette);

            database.save();
        }
        this.changes.clear();
    }

    private locToId(loc: Vector3) {
        return loc.x + loc.y * 16 + loc.z * 256;
    }
}

class BiomeDetector extends EventEmitter implements PooledResource {
    public id: number;

    private entity: Entity;

    constructor() {
        super();
    }

    detect(dim: Dimension, loc: Vector3) {
        return new Promise<number>((resolve, reject) => {
            try {
                if (!this.entityAvailable()) {
                    this.entity = dim.spawnEntity("wedit:biome_detector", loc);
                    // contentLog.debug("entity created:", this.id);
                } else {
                    this.entity.nameTag = "wedit:biome_update";
                    this.entity.teleport(loc, {
                        dimension: dim,
                        rotation: { x: 0, y: 0 }
                    });
                    // contentLog.debug("entity tpd:", this.id);
                }
            } catch (err) {
                contentLog.debug("entity error #1:", this.id);
                contentLog.debug(err);
                this.emit(errorEventSym);
                reject(err);
            }

            const onEvent = () => {
                try {
                    const biomeId = biomeScores.getScore(this.entity.scoreboardIdentity);
                    this.entity.triggerEvent("wedit:despawn");

                    this.emit(readyEventSym);
                    resolve(biomeId);
                } catch (err) {
                    contentLog.debug("entity error #2:", this.id);
                    contentLog.debug(err);
                    this.emit(errorEventSym);
                    reject(err);
                } finally {
                    world.afterEvents.dataDrivenEntityTrigger.unsubscribe(onEvent);
                }
            };
            world.afterEvents.dataDrivenEntityTrigger.subscribe(onEvent, {
                entities: [this.entity],
                eventTypes: ["wedit:biome_update"]
            });
        });
    }

    close() {
        if (this.entityAvailable()) {
            contentLog.debug("entity removed:", this.id);
            this.entity.triggerEvent("wedit:despawn");
        }
    }

    private entityAvailable() {
        if (!this.entity) return false;
        try {
            // eslint-disable-next-line no-self-assign
            this.entity.nameTag = this.entity.nameTag;
            return true;
        } catch {
            return false;
        }
    }
}

const detectorPool = new ResourcePool({
    constructor: BiomeDetector,
    arguments: [],
    maxCount: 32,

    log: () => {
    // if(logLevel < 1) {
    //   contentLog.error(...args);
    // } else if (logLevel < 2) {
    //   contentLog.log(...args);
    // } else {
    //   contentLog.debug(...args);
    // }
    },

    busyTimeout: 100,
    idleTimeout: 200
});

const biomeScores = world.scoreboard.getObjective("wedit:biome") ?? world.scoreboard.addObjective("wedit:biome", "");

async function getBiomeId(dim: Dimension, loc: Vector3) {
    const detector = await detectorPool.allocate();
    return await detector.detect(dim, loc);
}

const nameToId = {
    ocean: 0,
    plains: 1,
    desert: 2,
    extreme_hills: 3,
    forest: 4,
    taiga: 5,
    swampland: 6,
    river: 7,
    hell: 8,
    the_end: 9,
    legacy_frozen_ocean: 10,
    frozen_river: 11,
    ice_plains: 12,
    ice_mountains: 13,
    mushroom_island: 14,
    mushroom_island_shore: 15,
    beach: 16,
    desert_hills: 17,
    forest_hills: 18,
    taiga_hills: 19,
    extreme_hills_edge: 20,
    jungle: 21,
    jungle_hills: 22,
    jungle_edge: 23,
    deep_ocean: 24,
    stone_beach: 25,
    cold_beach: 26,
    birch_forest: 27,
    birch_forest_hills: 28,
    roofed_forest: 29,
    cold_taiga: 30,
    cold_taiga_hills: 31,
    mega_taiga: 32,
    mega_taiga_hills: 33,
    extreme_hills_plus_trees: 34,
    savanna: 35,
    savanna_plateau: 36,
    mesa: 37,
    mesa_plateau_stone: 38,
    mesa_plateau: 39,
    warm_ocean: 40,
    deep_warm_ocean: 41,
    lukewarm_ocean: 42,
    deep_lukewarm_ocean: 43,
    cold_ocean: 44,
    deep_cold_ocean: 45,
    frozen_ocean: 46,
    deep_frozen_ocean: 47,
    bamboo_jungle: 48,
    bamboo_jungle_hills: 49,
    sunflower_plains: 129,
    desert_mutated: 130,
    extreme_hills_mutated: 131,
    flower_forest: 132,
    taiga_mutated: 133,
    swampland_mutated: 134,
    ice_plains_spikes: 140,
    jungle_mutated: 149,
    jungle_edge_mutated: 151,
    birch_forest_mutated: 155,
    birch_forest_hills_mutated: 156,
    roofed_forest_mutated: 157,
    cold_taiga_mutated: 158,
    redwood_taiga_mutated: 160,
    redwood_taiga_hills_mutated: 161,
    extreme_hills_plus_trees_mutated: 162,
    savanna_mutated: 163,
    savanna_plateau_mutated: 164,
    mesa_bryce: 165,
    mesa_plateau_stone_mutated: 166,
    mesa_plateau_mutated: 167,
    soulsand_valley: 178,
    crimson_forest: 179,
    warped_forest: 180,
    basalt_deltas: 181,
    jagged_peaks: 182,
    frozen_peaks: 183,
    snowy_slopes: 184,
    grove: 185,
    meadow: 186,
    lush_caves: 187,
    dripstone_caves: 188,
    stony_peaks: 189,
    deep_dark: 190,
    mangrove_swamp: 191,
    cherry_grove: 192
} as const;
const idToName = Object.fromEntries(Object.entries(nameToId).map(([k, v]) => [v, k]));

export { getBiomeId, BiomeChanges, Biome };