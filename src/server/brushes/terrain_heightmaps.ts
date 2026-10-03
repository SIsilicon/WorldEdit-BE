export interface TerrainHeightmap {
    width: number;
    height: number;
    data: Uint8Array;
}

type HeightmapSampler = (x: number, z: number, distance: number) => number;

function createHeightmap(sampler: HeightmapSampler, size = 65): TerrainHeightmap {
    const data = new Uint8Array(size * size);

    for (let z = 0; z < size; z++) {
        for (let x = 0; x < size; x++) {
            const nx = (x / (size - 1)) * 2 - 1;
            const nz = (z / (size - 1)) * 2 - 1;

            const distance = Math.hypot(nx, nz);

            const value = Math.min(1, Math.max(0, sampler(nx, nz, distance)));

            data[z * size + x] = Math.round(value * 255);
        }
    }

    return {
        width: size,
        height: size,
        data,
    };
}

function edgeFade(distance: number) {
    if (distance >= 1) return 0;
    if (distance <= 0.8) return 1;

    const t = (distance - 0.8) / 0.2;

    return 1 - t * t * (3 - 2 * t);
}

const mountain1 = createHeightmap((x, z, distance) => {
    const mainPeak = Math.exp(-(x * x * 2.2 + z * z * 1.6));

    const ridge = Math.exp(-(Math.pow(x + z * 0.35, 2) * 7 + z * z * 0.8)) * 0.35;

    const shoulder = Math.exp(-(Math.pow(x - 0.35, 2) * 7 + Math.pow(z + 0.15, 2) * 5)) * 0.25;

    return (mainPeak + ridge + shoulder) * edgeFade(distance);
});

const mountain2 = createHeightmap((x, z, distance) => {
    const peak1 = Math.exp(-(Math.pow(x + 0.25, 2) * 5 + Math.pow(z + 0.1, 2) * 3));

    const peak2 = Math.exp(-(Math.pow(x - 0.3, 2) * 8 + Math.pow(z - 0.2, 2) * 5)) * 0.75;

    const ridge = Math.exp(-(Math.pow(x - z * 0.45, 2) * 10 + z * z)) * 0.3;

    return Math.min(1, peak1 + peak2 + ridge) * edgeFade(distance);
});

const cliff1 = createHeightmap((x, z, distance) => {
    const irregularity = Math.sin(z * 7) * 0.08 + Math.sin(z * 13) * 0.03;

    const cliffPosition = x + irregularity;

    const transition = Math.min(1, Math.max(0, (-cliffPosition + 0.18) / 0.36));

    const cliff = transition * transition * (3 - 2 * transition);

    return cliff * edgeFade(distance);
});

const mesa1 = createHeightmap((_x, _z, distance) => {
    if (distance <= 0.45) {
        return 1;
    }

    if (distance >= 0.85) {
        return 0;
    }

    const t = (distance - 0.45) / (0.85 - 0.45);

    return 1 - t * t * (3 - 2 * t);
});

const volcano1 = createHeightmap((_x, _z, distance) => {
    const ring = Math.exp(-Math.pow(distance - 0.48, 2) * 45);

    return ring * edgeFade(distance);
});

const heightmaps = new Map<string, TerrainHeightmap>([
    ["mountain1", mountain1],
    ["mountain2", mountain2],
    ["cliff1", cliff1],
    ["mesa1", mesa1],
    ["volcano1", volcano1],
]);

export function hasTerrainHeightmap(name: string) {
    return heightmaps.has(name);
}

export function sampleTerrainHeightmap(name: string, u: number, v: number) {
    const heightmap = heightmaps.get(name);

    if (!heightmap) {
        throw new Error(`Unknown terrain heightmap: ${name}`);
    }

    const clampedU = Math.min(Math.max(u, 0), 1);

    const clampedV = Math.min(Math.max(v, 0), 1);

    const x = clampedU * (heightmap.width - 1);

    const z = clampedV * (heightmap.height - 1);

    const x0 = Math.floor(x);
    const z0 = Math.floor(z);

    const x1 = Math.min(x0 + 1, heightmap.width - 1);

    const z1 = Math.min(z0 + 1, heightmap.height - 1);

    const tx = x - x0;
    const tz = z - z0;

    const getValue = (px: number, pz: number) => heightmap.data[pz * heightmap.width + px] / 255;

    const top = getValue(x0, z0) * (1 - tx) + getValue(x1, z0) * tx;

    const bottom = getValue(x0, z1) * (1 - tx) + getValue(x1, z1) * tx;

    return top * (1 - tz) + bottom * tz;
}

export function getTerrainHeightmapNames() {
    return [...heightmaps.keys()];
}
