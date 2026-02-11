import { BiomeTypes, Dimension, Vector3, world } from "@minecraft/server";
import { commandSyntaxError, contentLog, CustomArgType, Databases, Vector } from "@notbeer-api";
import { locToString, stringToLoc, wrap } from "../util.js";
import { Jobs } from "./jobs.js";

class Biome implements CustomArgType {
    private id = "minecraft:ocean";

    constructor(id?: string) {
        if (id) {
            const obj = Biome.parseArgs([id]).result;
            this.id = obj.id;
        }
    }

    getId() {
        return this.id;
    }

    clone() {
        const clone = new Biome();
        clone.id = this.id;
        return clone;
    }

    toString() {
        return `[biome: ${this.id}]`;
    }

    static parseArgs(args: string[], index = 0) {
        const input = args[index];
        const result = new Biome();
        if (!input) return { result, argIndex: index + 1 };

        const biomeType = BiomeTypes.get(input);
        if (biomeType) {
            result.id = biomeType.id;
        } else {
            const err: commandSyntaxError = {
                isSyntaxError: true,
                stack: contentLog.stack(),
                idx: index,
            };
            throw err;
        }
        return { result, argIndex: index + 1 };
    }
}

class BiomeChanges {
    // map of subchunks; each subchunk is a map of biome changes
    private changes: Map<string, Map<number, string>> = new Map();
    private heightRange: { min: number; max: number };

    constructor(public dimension: Dimension) {
        this.heightRange = dimension.heightRange;
    }

    *setBiome(loc: Vector3, biome: string) {
        if (loc.y < this.heightRange.min || loc.y >= this.heightRange.max) return;

        const subChunkCoord = locToString(new Vector(Math.floor(loc.x / 16), Math.floor(loc.y / 16), Math.floor(loc.z / 16)));

        if (!this.changes.has(subChunkCoord)) this.changes.set(subChunkCoord, new Map());
        const subChunk = this.changes.get(subChunkCoord);
        subChunk.set(this.locToId(new Vector(wrap(loc.x, 16), wrap(loc.y, 16), wrap(loc.z, 16))), biome);

        if (subChunk.size == 4096) yield* this.flush();
    }

    *flush() {
        for (const [chunk, data] of this.changes) {
            const tableName = `biome,${this.dimension.id},${chunk}`;
            const database = Databases.load<{ biomes: number[]; palette: string[] }>(tableName, world);

            let biomes: string[] = [];
            if (!("biomes" in database.data)) {
                biomes.length = 4096;
                biomes = biomes.fill("");
            } else {
                const palette: string[] = database.data.palette;
                biomes = database.data.biomes.map((idx) => (idx ? palette[idx - 1] : ""));
            }

            for (const [loc, biome] of data.entries()) biomes[loc] = biome;

            const paletteMap = new Map<string, number>();
            for (const biome of biomes) if (biome !== "") paletteMap.set(biome, null);
            const newPalette = Array.from(paletteMap.keys());
            paletteMap.clear();
            newPalette.forEach((val, idx) => paletteMap.set(val, idx + 1));
            paletteMap.set("", 0);

            database.data.biomes = biomes.map((biome) => paletteMap.get(biome));
            database.data.palette = newPalette;
            database.save();

            // Force update chunk to ensure it's saved in the world data.
            const updateLocation = stringToLoc(chunk).mul(16);
            const updateBlock = yield* Jobs.loadBlock(updateLocation);
            const oldPermutation = updateBlock.permutation;
            updateBlock.setType(updateBlock.matches("air") ? "stone" : "air");
            updateBlock.setPermutation(oldPermutation);
        }
        this.changes.clear();
    }

    /**
     * Converts an offset from the minimum corner of the chunk to a chunk block index.
     *
     * @param offset The offset from the minimum corner of the chunk.
     * @returns The chunk block index.
     */
    private locToId(offset: Vector3): number {
        return ((offset.x & 0xf) << 8) | (offset.y & 0xf) | ((offset.z & 0xf) << 4);
    }
}

export { BiomeChanges, Biome };
