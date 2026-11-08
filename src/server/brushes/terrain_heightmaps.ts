import { terrainHeightmapData } from "./terrain_heightmap_data.js";

export interface TerrainHeightmap {
    width: number;
    height: number;
    data: Uint8Array;
}

interface EncodedTerrainHeightmap {
    width: number;
    height: number;
    data: string;
}

const encodedHeightmaps: Record<string, EncodedTerrainHeightmap> = terrainHeightmapData;

const decodedHeightmaps = new Map<string, TerrainHeightmap>();

const heightmapCategories = new Map<string, string[]>();

for (const name of Object.keys(encodedHeightmaps)) {
    const category = name.replace(/\d+$/, "");

    const categoryMaps = heightmapCategories.get(category);

    if (categoryMaps) {
        categoryMaps.push(name);
    } else {
        heightmapCategories.set(category, [name]);
    }
}

for (const maps of heightmapCategories.values()) {
    maps.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP = new Int16Array(128).fill(-1);

for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(i)] = i;
}

function decodeBase64(encoded: string) {
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;

    const output = new Uint8Array(Math.floor((encoded.length * 3) / 4) - padding);

    let outputIndex = 0;

    for (let i = 0; i < encoded.length; i += 4) {
        const a = BASE64_LOOKUP[encoded.charCodeAt(i)];
        const b = BASE64_LOOKUP[encoded.charCodeAt(i + 1)];

        const c = encoded[i + 2] === "=" ? 0 : BASE64_LOOKUP[encoded.charCodeAt(i + 2)];

        const d = encoded[i + 3] === "=" ? 0 : BASE64_LOOKUP[encoded.charCodeAt(i + 3)];

        const value = (a << 18) | (b << 12) | (c << 6) | d;

        if (outputIndex < output.length) {
            output[outputIndex++] = (value >> 16) & 0xff;
        }

        if (outputIndex < output.length) {
            output[outputIndex++] = (value >> 8) & 0xff;
        }

        if (outputIndex < output.length) {
            output[outputIndex++] = value & 0xff;
        }
    }

    return output;
}

function getTerrainHeightmap(name: string) {
    const cached = decodedHeightmaps.get(name);

    if (cached) {
        return cached;
    }

    const encoded = encodedHeightmaps[name];

    if (!encoded) {
        throw new Error(`Unknown terrain heightmap: ${name}`);
    }

    const data = decodeBase64(encoded.data);

    if (data.length !== encoded.width * encoded.height) {
        throw new Error(`Invalid terrain heightmap "${name}": expected ${encoded.width * encoded.height} bytes, got ${data.length}`);
    }

    const heightmap: TerrainHeightmap = {
        width: encoded.width,
        height: encoded.height,
        data,
    };

    decodedHeightmaps.set(name, heightmap);

    return heightmap;
}

export function hasTerrainHeightmap(name: string) {
    return Object.prototype.hasOwnProperty.call(encodedHeightmaps, name) || heightmapCategories.has(name);
}

export function resolveTerrainHeightmap(name: string) {
    if (Object.prototype.hasOwnProperty.call(encodedHeightmaps, name)) {
        return name;
    }

    const categoryMaps = heightmapCategories.get(name);

    if (!categoryMaps?.length) {
        throw new Error(`Unknown terrain heightmap or category: ${name}`);
    }

    return categoryMaps[Math.floor(Math.random() * categoryMaps.length)];
}

export function sampleTerrainHeightmap(name: string, u: number, v: number) {
    const heightmap = getTerrainHeightmap(name);

    const clampedU = Math.min(Math.max(u, 0), 1);
    const clampedV = Math.min(Math.max(v, 0), 1);

    const width = heightmap.width;
    const height = heightmap.height;
    const data = heightmap.data;

    const x = clampedU * (width - 1);
    const z = clampedV * (height - 1);

    const x0 = Math.floor(x);
    const z0 = Math.floor(z);

    const x1 = Math.min(x0 + 1, width - 1);
    const z1 = Math.min(z0 + 1, height - 1);

    const tx = x - x0;
    const tz = z - z0;

    const topLeft = data[z0 * width + x0];
    const topRight = data[z0 * width + x1];

    const bottomLeft = data[z1 * width + x0];
    const bottomRight = data[z1 * width + x1];

    const top = topLeft * (1 - tx) + topRight * tx;
    const bottom = bottomLeft * (1 - tx) + bottomRight * tx;

    return (top * (1 - tz) + bottom * tz) / 255;
}

export function getTerrainHeightmapNames() {
    return Object.keys(encodedHeightmaps);
}

export function getTerrainHeightmapCategoryNames() {
    return [...heightmapCategories.entries()]
        .filter(([, maps]) => maps.length > 1)
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b));
}
