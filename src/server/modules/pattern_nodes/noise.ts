import { BlockPermutation } from "@minecraft/server";
import { Vector, regionIterateBlocks } from "@notbeer-api";
import { Token } from "../extern/tokenizr.js";
import { BlockUnit } from "../block_parsing.js";
import { Noise } from "../noise.js";
import { PatternNode, patternContext } from "./base.js";
import { ChainPatternNode, PercentPatternNode, GradientPatternNode } from "./standard.js";

// Percent weights belong to the noise palette, not to a random block-by-block chain.
// Keep metadata separate so unweighted noise follows the exact previous code path.
const weightedNoisePalettes = new WeakMap<PatternNode[], number[]>();
const weightedNoiseSamples = new WeakMap<Noise, number[]>();

export function collectEvenPatternNodes(node: PatternNode): PatternNode[] {
    if (node instanceof PercentPatternNode) {
        const patterns = [node.nodes[0]];
        weightedNoisePalettes.set(patterns, [100]);
        return patterns;
    }

    if (node instanceof ChainPatternNode && node.hasExplicitWeights) {
        const patterns = [...node.nodes];
        weightedNoisePalettes.set(
            patterns,
            patterns.map((_, i) => Math.max(0, node.getWeight(i)))
        );
        return patterns;
    }

    // Original behavior, unchanged for patterns with no explicit percentages.
    const patterns: PatternNode[] = [];
    const collect = (current: PatternNode) => {
        if (current instanceof ChainPatternNode && current.evenDistribution) {
            for (const child of current.nodes) collect(child);
        } else {
            patterns.push(current);
        }
    };

    collect(node);
    return patterns;
}

function getPatternFromValue(patterns: PatternNode[], value: number, weights: number[] = weightedNoisePalettes.get(patterns)) {
    const clamped = Math.min(Math.max(value, 0), 1 - Number.EPSILON);

    if (weights) {
        const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
        if (total > 0) {
            const target = clamped * total;
            let cumulative = 0;
            for (let i = 0; i < patterns.length; i++) {
                cumulative += Math.max(0, weights[i] ?? 0);
                if (target < cumulative) return patterns[i];
            }
        }
    }

    // Original unweighted index calculation, unchanged.
    return patterns[Math.floor(clamped * patterns.length)];
}

// Convert each noise field to an approximate percentile using its own distribution.
// This keeps the shapes coherent while letting percentages affect their relative area.
function noisePercentile(noise: Noise, value: number, sample: (noise: Noise, x: number, y: number, z: number) => number) {
    let sorted = weightedNoiseSamples.get(noise);
    if (!sorted) {
        sorted = [];
        for (let i = 0; i < 512; i++) {
            sorted.push(sample(noise, (i + 0.314) * 0.754877666, (i + 0.527) * 0.569840296, (i + 0.731) * 0.438447187));
        }
        sorted.sort((a, b) => a - b);
        weightedNoiseSamples.set(noise, sorted);
    }

    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (sorted[mid] < value) lo = mid + 1;
        else hi = mid;
    }

    if (lo === 0) return 0.5 / sorted.length;
    if (lo === sorted.length) return 1 - 0.5 / sorted.length;
    const lower = sorted[lo - 1];
    const upper = sorted[lo];
    const fraction = upper > lower ? (value - lower) / (upper - lower) : 0.5;
    return Math.max(0.000001, Math.min(0.999999, (lo - 0.5 + fraction) / sorted.length));
}

// Gumbel-max: if percentiles are uniform, each option wins with probability
// proportional to its weight. Noise varies smoothly across space, so regions do too.
function weightedNoiseIndex(noises: Noise[], weights: number[], x: number, y: number, z: number, sample: (noise: Noise, x: number, y: number, z: number) => number) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < noises.length; i++) {
        const weight = weights[i] ?? 0;
        if (weight <= 0) continue;
        const value = sample(noises[i], x, y, z);
        const percentile = noisePercentile(noises[i], value, sample);
        const score = Math.log(weight) - Math.log(-Math.log(percentile));
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestIndex;
}

export class BlobPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private offsets: Vector[] = [];
    private perms: { [key: number]: BlockPermutation } = {};
    private ranges: { [key: number]: { range: [Vector, Vector] } } = {};
    private points: { [key: number]: Vector } = {};

    private isRadial = false;
    private activePattern: PatternNode;

    constructor(
        token: Token,
        public size: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.activePattern = this.nodes[0] instanceof PercentPatternNode ? this.nodes[0].nodes[0] : this.nodes[0];
        this.isRadial = this.activePattern instanceof GradientPatternNode && this.activePattern.cardinal === "radial";
        this.perms = {};
        this.ranges = {};
        this.points = {};
        this.offsets = [];
        for (const { x, y, z } of regionIterateBlocks(new Vector(-1, -1, -1), new Vector(1, 1, 1))) {
            this.offsets.push(new Vector(x * this.size, y * this.size, z * this.size));
        }
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        const size = this.size;
        const blockLoc = Vector.from(block.location);
        const cellLoc = blockLoc.div(size).floor().mul(size);
        let closestCell = 0;
        let minDist = Infinity;
        for (const offset of this.offsets) {
            const locX = cellLoc.x + offset.x;
            const locY = cellLoc.y + offset.y;
            const locZ = cellLoc.z + offset.z;
            // cell key
            const neighbour = Math.floor(Math.floor(locX / size) * 4576.498 + Math.floor(locY / size) * 76392.953 + Math.floor(locZ / size) * 203478.295) % 1024;
            if (!this.points[neighbour]) {
                const point = new Vector(this.randomNum(), this.randomNum(), this.randomNum());
                this.points[neighbour] = point;
                if (this.isRadial) {
                    const cellPoint = point.offset(locX, locY, locZ);
                    this.ranges[neighbour] = { range: [cellPoint.offset(-this.size, -this.size, -this.size), cellPoint.offset(this.size, this.size, this.size)] };
                }
            }
            const point = this.points[neighbour];

            const distance = Math.hypot(locX + point.x - blockLoc.x, locY + point.y - blockLoc.y, locZ + point.z - blockLoc.z);
            if (distance < minDist) {
                closestCell = neighbour;
                minDist = distance;
            }
        }

        if (this.isRadial) {
            const subGradientRadius = this.ranges[closestCell].range[1].distanceTo(this.ranges[closestCell].range[0]) / 2;
            return this.activePattern.getPermutation(block, { ...context, gradientRadius: subGradientRadius });
        } else {
            if (!(closestCell in this.perms)) this.perms[closestCell] = this.activePattern.getPermutation(block, context);
            return this.perms[closestCell];
        }
    }

    toJSON() {
        return { type: "blob", settings: { size: this.size }, children: [this.nodes[0].toJSON()] };
    }

    private randomNum() {
        return Math.random() * (this.size - 1);
    }
}

export class PerlinPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) => noise.perlin3D(x, y, z));
            return this.patterns[index].getPermutation(block, context);
        }

        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].perlin3D(loc.x / this.size, loc.y / this.size, loc.z / this.size);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "perlin",
            settings: { size: this.size },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class CrackedPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private offsets: Vector[] = [];
    private points: { [key: number]: Vector } = {};
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public thickness: number = 1,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.points = {};
        this.offsets = [];
        this.patterns = collectEvenPatternNodes(this.nodes[0]);

        for (const { x, y, z } of regionIterateBlocks(new Vector(-1, -1, -1), new Vector(1, 1, 1))) {
            this.offsets.push(new Vector(x * this.size, y * this.size, z * this.size));
        }
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        const size = this.size;
        const blockLoc = Vector.from(block.location);
        const cellLoc = blockLoc.div(size).floor().mul(size);

        let nearest = Infinity;
        let secondNearest = Infinity;
        let nearestCell = 0;
        let secondNearestCell = 0;

        for (const offset of this.offsets) {
            const locX = cellLoc.x + offset.x;
            const locY = cellLoc.y + offset.y;
            const locZ = cellLoc.z + offset.z;

            const neighbour = Math.floor(Math.floor(locX / size) * 4576.498 + Math.floor(locY / size) * 76392.953 + Math.floor(locZ / size) * 203478.295) % 1024;

            if (!this.points[neighbour]) {
                this.points[neighbour] = new Vector(this.randomNum(), this.randomNum(), this.randomNum());
            }

            const point = this.points[neighbour];

            const distance = Math.hypot(locX + point.x - blockLoc.x, locY + point.y - blockLoc.y, locZ + point.z - blockLoc.z);

            if (distance < nearest) {
                secondNearest = nearest;
                secondNearestCell = nearestCell;

                nearest = distance;
                nearestCell = neighbour;
            } else if (distance < secondNearest) {
                secondNearest = distance;
                secondNearestCell = neighbour;
            }
        }

        const crackDistance = secondNearest - nearest;

        const basePattern = this.patterns[0] ?? this.nodes[0];

        if (crackDistance > this.thickness || this.patterns.length < 2) {
            return basePattern.getPermutation(block, context);
        }

        // Use the two closest cells to choose a consistent crack color.
        const a = Math.min(nearestCell, secondNearestCell);
        const b = Math.max(nearestCell, secondNearestCell);

        const hash = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const cracks = this.patterns.slice(1);
            const color = getPatternFromValue(cracks, hash / 4294967296, weights.slice(1));
            return color.getPermutation(block, context);
        }

        const crackIndex = 1 + (hash % (this.patterns.length - 1));

        return this.patterns[crackIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "cracked",
            settings: { size: this.size, thickness: this.thickness },
            children: [this.nodes[0].toJSON()],
        };
    }

    private randomNum() {
        return Math.random() * (this.size - 1);
    }
}

export class WoodPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public bands: number = 10,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = new Noise();
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;

        const noiseValue = this.noise.perlin3D(loc.x / this.size, loc.y / this.size, loc.z / this.size);

        const g = noiseValue * this.bands;
        const grain = g - Math.floor(g);

        const weights = weightedNoisePalettes.get(this.patterns);
        const value = weights
            ? noisePercentile(this.noise, grain, (noise, x, y, z) => {
                  const grainValue = noise.perlin3D(x, y, z) * this.bands;
                  return grainValue - Math.floor(grainValue);
              })
            : grain;
        return getPatternFromValue(this.patterns, value).getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "wood",
            settings: { size: this.size, bands: this.bands },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class TurbulencePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public octaves: number = 4,
        public persistence: number = 0.5,
        public lacunarity: number = 2,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) =>
                noise.turbulence3D(x, y, z, this.octaves, this.persistence, this.lacunarity)
            );
            return this.patterns[index].getPermutation(block, context);
        }
        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].turbulence3D(loc.x / this.size, loc.y / this.size, loc.z / this.size, this.octaves, this.persistence, this.lacunarity);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "turbulence",
            settings: { size: this.size, octaves: this.octaves, persistence: this.persistence, lacunarity: this.lacunarity },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class MarblePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public bands: number = 1,
        public distortion: number = 8,
        public octaves: number = 4,
        public persistence: number = 0.5,
        public lacunarity: number = 2,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = new Noise();
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const x = loc.x / this.size;
        const y = loc.y / this.size;
        const z = loc.z / this.size;
        const distortion = (this.noise.octaveNoise3D(x, y, z, this.octaves, this.persistence, this.lacunarity) - 0.5) * this.distortion;
        const bandValue = (Math.sin((x + y * 0.35 + z) * Math.PI * 2 * this.bands + distortion) + 1) / 2;

        const weights = weightedNoisePalettes.get(this.patterns);
        const value = weights
            ? noisePercentile(this.noise, bandValue, (noise, sx, sy, sz) => {
                  const warp = (noise.octaveNoise3D(sx, sy, sz, this.octaves, this.persistence, this.lacunarity) - 0.5) * this.distortion;
                  return (Math.sin((sx + sy * 0.35 + sz) * Math.PI * 2 * this.bands + warp) + 1) / 2;
              })
            : bandValue;
        return getPatternFromValue(this.patterns, value).getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "marble",
            settings: { size: this.size, bands: this.bands, distortion: this.distortion, octaves: this.octaves, persistence: this.persistence, lacunarity: this.lacunarity },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class FbmPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public octaves: number = 4,
        public persistence: number = 0.5,
        public lacunarity: number = 2,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) =>
                noise.octaveNoise3D(x, y, z, this.octaves, this.persistence, this.lacunarity)
            );
            return this.patterns[index].getPermutation(block, context);
        }
        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].octaveNoise3D(loc.x / this.size, loc.y / this.size, loc.z / this.size, this.octaves, this.persistence, this.lacunarity);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "fbm",
            settings: { size: this.size, octaves: this.octaves, persistence: this.persistence, lacunarity: this.lacunarity },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class VeinsPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public width: number = 0.1,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = new Noise();
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const ridge = this.noise.ridged3D(loc.x / this.size, loc.y / this.size, loc.z / this.size);
        const veinStart = 1 - this.width;

        if (ridge < veinStart) {
            return this.patterns[0].getPermutation(block, context);
        }

        const veinPatterns = this.patterns.slice(1);
        const veinValue = (ridge - veinStart) / (1 - veinStart);

        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            if (this.width <= 0) return this.patterns[0].getPermutation(block, context);
            const sample = (noise: Noise, x: number, y: number, z: number) => noise.ridged3D(x, y, z);
            const minPercentile = noisePercentile(this.noise, veinStart, sample);
            const currentPercentile = noisePercentile(this.noise, ridge, sample);
            const selectedValue = (currentPercentile - minPercentile) / Math.max(Number.EPSILON, 1 - minPercentile);
            return getPatternFromValue(veinPatterns, selectedValue, weights.slice(1)).getPermutation(block, context);
        }

        return getPatternFromValue(veinPatterns, veinValue).getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "veins",
            settings: { size: this.size, width: this.width },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class WarpedPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public strength: number = 1.5,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) => noise.warpedPerlin3D(x, y, z, this.strength));
            return this.patterns[index].getPermutation(block, context);
        }
        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].warpedPerlin3D(loc.x / this.size, loc.y / this.size, loc.z / this.size, this.strength);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "warped",
            settings: { size: this.size, strength: this.strength },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class SimplexPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) => noise.simplex3D(x, y, z));
            return this.patterns[index].getPermutation(block, context);
        }
        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].simplex3D(loc.x / this.size, loc.y / this.size, loc.z / this.size);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "simplex",
            settings: { size: this.size },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class ValuePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise[] = [];
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = this.patterns.map(() => new Noise());
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const weights = weightedNoisePalettes.get(this.patterns);
        if (weights) {
            const index = weightedNoiseIndex(this.noise, weights, loc.x / this.size, loc.y / this.size, loc.z / this.size, (noise, x, y, z) => noise.value3D(x, y, z));
            return this.patterns[index].getPermutation(block, context);
        }
        let bestIndex = 0;
        let bestValue = -Infinity;

        for (let i = 0; i < this.patterns.length; i++) {
            const value = this.noise[i].value3D(loc.x / this.size, loc.y / this.size, loc.z / this.size);

            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }

        return this.patterns[bestIndex].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "value",
            settings: { size: this.size },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class PingPongPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private noise: Noise;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public strength: number = 2,
        public octaves: number = 4,
        public persistence: number = 0.5,
        public lacunarity: number = 2,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();

        this.patterns = collectEvenPatternNodes(this.nodes[0]);
        this.noise = new Noise();
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation {
        if (this.patterns.length === 1) {
            return this.patterns[0].getPermutation(block, context);
        }

        const loc = block.location;
        const value = this.noise.pingPong3D(loc.x / this.size, loc.y / this.size, loc.z / this.size, this.octaves, this.persistence, this.lacunarity, this.strength);

        const weights = weightedNoisePalettes.get(this.patterns);
        const selectedValue = weights ? noisePercentile(this.noise, value, (noise, x, y, z) => noise.pingPong3D(x, y, z, this.octaves, this.persistence, this.lacunarity, this.strength)) : value;
        return getPatternFromValue(this.patterns, selectedValue).getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "pingpong",
            settings: { size: this.size, strength: this.strength, octaves: this.octaves, persistence: this.persistence, lacunarity: this.lacunarity },
            children: [this.nodes[0].toJSON()],
        };
    }
}
