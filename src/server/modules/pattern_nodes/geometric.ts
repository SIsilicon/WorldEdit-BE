import { BlockPermutation } from "@minecraft/server";
import { Token } from "../extern/tokenizr.js";
import { BlockUnit } from "../block_parsing.js";
import { PatternNode, patternContext } from "./base.js";
import { collectEvenPatternNodes } from "./noise.js";

export class GridPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public sizeX: number,
        public sizeZ: number,
        public sizeY: number = 0,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        if (!this.patterns.length) return undefined;

        const loc = block.location;

        const gridX = Math.floor(loc.x / this.sizeX);
        const gridZ = Math.floor(loc.z / this.sizeZ);

        // In 2D mode, ignore Y completely.
        const gridY = this.sizeY > 0 ? Math.floor(loc.y / this.sizeY) : 0;

        const cell = gridX + gridZ + gridY;

        // Positive modulo also works with negative world coordinates.
        const index = ((cell % this.patterns.length) + this.patterns.length) % this.patterns.length;

        return this.patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "grid",
            settings: {
                sizeX: this.sizeX,
                sizeZ: this.sizeZ,
                sizeY: this.sizeY,
            },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class TrianglePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

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
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        if (!this.patterns.length) return undefined;

        // Two equilateral triangles form each 60-degree lattice rhombus.
        // Coordinates are world-aligned and continue through negative positions.
        const u = (block.location.x - block.location.z / Math.sqrt(3)) / this.size;
        const v = (2 * block.location.z) / (Math.sqrt(3) * this.size);
        const col = Math.floor(u);
        const row = Math.floor(v);
        const orientation = u - col + (v - row) >= 1 ? 1 : 0;

        // With two patterns, upward/downward triangles alternate.
        const cell = 2 * (col + row) + orientation;
        const index = ((cell % this.patterns.length) + this.patterns.length) % this.patterns.length;
        return this.patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return { type: "triangle", settings: { size: this.size }, children: [this.nodes[0].toJSON()] };
    }
}

export class HexagonPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

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
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        if (!this.patterns.length) return undefined;

        // Pointy-top regular hexagons. 'size' is the distance from center to vertex.
        // Convert the position into a fractional axial hex coordinate.
        const x = block.location.x;
        const z = block.location.z;
        const qf = ((Math.sqrt(3) * x) / 3 - z / 3) / this.size;
        const rf = (2 * z) / 3 / this.size;
        const sf = -qf - rf;

        // Cube rounding picks the closest hexagonal cell without seams.
        let q = Math.round(qf);
        let r = Math.round(rf);
        let s = Math.round(sf);
        const dq = Math.abs(q - qf);
        const dr = Math.abs(r - rf);
        const ds = Math.abs(s - sf);
        if (dq > dr && dq > ds) q = -r - s;
        else if (dr > ds) r = -q - s;
        else s = -q - r;

        // Three materials create a proper three-color honeycomb.
        // Two colors still work, but some neighboring hexagons will share a color.
        const cell = q - r;
        const index = ((cell % this.patterns.length) + this.patterns.length) % this.patterns.length;
        return this.patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return { type: "hexagon", settings: { size: this.size }, children: [this.nodes[0].toJSON()] };
    }
}

// Stable cell-based randomness for decorative patterns. Unlike Math.random(),
// the same world coordinates always produce the same cell after another ;set.
function geometricCellRandom(x: number, z: number, seed: number) {
    let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export class BrickPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public width: number,
        public height: number,
        public mortar: number = 1,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        const patterns = this.patterns;
        if (!patterns.length) return undefined;
        if (patterns.length === 1) return patterns[0].getPermutation(block, context);

        const loc = block.location;
        const row = Math.floor(loc.z / this.height);
        const stagger = ((row % 2) + 2) % 2 ? this.width / 2 : 0;
        const movedX = loc.x + stagger;
        const col = Math.floor(movedX / this.width);
        const innerX = movedX - col * this.width;
        const innerZ = loc.z - row * this.height;
        const brickCount = patterns.length - 1;

        // Last material is mortar. Other materials are the brick colors.
        if (innerX < this.mortar || innerZ < this.mortar) return patterns[patterns.length - 1].getPermutation(block, context);
        const index = Math.floor(geometricCellRandom(col, row, 19) * brickCount);
        return patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return { type: "brick", settings: { width: this.width, height: this.height, mortar: this.mortar }, children: [this.nodes[0].toJSON()] };
    }
}

export class DotsPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public spacing: number,
        public radius: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        const patterns = this.patterns;
        if (!patterns.length) return undefined;
        if (patterns.length === 1) return patterns[0].getPermutation(block, context);

        const loc = block.location;
        const gx = Math.floor(loc.x / this.spacing);
        const gz = Math.floor(loc.z / this.spacing);
        const dx = loc.x - (gx + 0.5) * this.spacing;
        const dz = loc.z - (gz + 0.5) * this.spacing;
        if (dx * dx + dz * dz > this.radius * this.radius) {
            return patterns[patterns.length - 1].getPermutation(block, context);
        }
        const index = Math.floor(geometricCellRandom(gx, gz, 23) * (patterns.length - 1));
        return patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return { type: "dots", settings: { spacing: this.spacing, radius: this.radius }, children: [this.nodes[0].toJSON()] };
    }
}

export class RingsPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public spacing: number,
        public thickness: number,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        const patterns = this.patterns;
        if (!patterns.length) return undefined;
        if (patterns.length === 1) return patterns[0].getPermutation(block, context);

        // Concentric ripples centered on the current selection / placement.
        const loc = block.location;
        const center = context.getCenter(loc);
        const distance = Math.hypot(loc.x - center.x, loc.z - center.z);
        const phase = distance % this.spacing;
        if (phase >= this.thickness) return patterns[patterns.length - 1].getPermutation(block, context);
        const band = Math.floor(distance / this.spacing);
        return patterns[band % (patterns.length - 1)].getPermutation(block, context);
    }

    toJSON() {
        return { type: "rings", settings: { spacing: this.spacing, thickness: this.thickness }, children: [this.nodes[0].toJSON()] };
    }
}

export class BubblesPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public averageRadius: number,
        public variation: number = 2,
        public edge: number = 2,
        public concentration: number = 0.6,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        const patterns = this.patterns;
        if (!patterns.length) return undefined;
        if (patterns.length === 1) return patterns[0].getPermutation(block, context);

        const maxRadius = this.averageRadius + this.variation;
        // Each bubble fits entirely inside its own jittered cell, so there is no overlap.
        const cellSize = 3 * maxRadius + 2;
        const loc = block.location;
        const gx = Math.floor(loc.x / cellSize);
        const gz = Math.floor(loc.z / cellSize);
        const outside = patterns[patterns.length - 1];
        if (geometricCellRandom(gx, gz, 41) >= this.concentration) return outside.getPermutation(block, context);

        const radius = Math.round(this.averageRadius + (geometricCellRandom(gx, gz, 43) * 2 - 1) * this.variation);
        const maxJitter = cellSize - 2 * maxRadius - 2;
        const cx = (gx + 0.5) * cellSize + (geometricCellRandom(gx, gz, 47) - 0.5) * maxJitter;
        const cz = (gz + 0.5) * cellSize + (geometricCellRandom(gx, gz, 53) - 0.5) * maxJitter;
        const dx = loc.x - cx;
        const dz = loc.z - cz;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared > radius * radius) return outside.getPermutation(block, context);

        if (patterns.length === 2) {
            // Two materials = hollow outline + background.
            if (distanceSquared < (radius - this.edge) * (radius - this.edge)) return outside.getPermutation(block, context);
            return patterns[0].getPermutation(block, context);
        }
        // Three or more materials = interior color(s), rim, background.
        if (distanceSquared >= (radius - this.edge) * (radius - this.edge)) return patterns[patterns.length - 2].getPermutation(block, context);
        const insideCount = patterns.length - 2;
        const insideIndex = Math.floor(geometricCellRandom(gx, gz, 59) * insideCount);
        return patterns[insideIndex].getPermutation(block, context);
    }

    toJSON() {
        return { type: "bubbles", settings: { averageRadius: this.averageRadius, variation: this.variation, edge: this.edge, concentration: this.concentration }, children: [this.nodes[0].toJSON()] };
    }
}

export class VoronoiPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;
    private patterns: PatternNode[] = [];

    constructor(
        token: Token,
        public size: number,
        public jitter: number = 0.8,
        node?: PatternNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        super.prepare();
        this.patterns = collectEvenPatternNodes(this.nodes[0]);
    }

    getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined {
        const patterns = this.patterns;
        if (!patterns.length) return undefined;
        if (patterns.length === 1) return patterns[0].getPermutation(block, context);

        const loc = block.location;
        const gx = Math.floor(loc.x / this.size);
        const gz = Math.floor(loc.z / this.size);
        let best = Infinity;
        let chosenX = gx;
        let chosenZ = gz;

        // Voronoi partition of jittered world-aligned lattice points.
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = gx + dx;
                const cz = gz + dz;
                const jitterX = (geometricCellRandom(cx, cz, 71) - 0.5) * this.jitter;
                const jitterZ = (geometricCellRandom(cx, cz, 73) - 0.5) * this.jitter;
                const px = (cx + 0.5 + jitterX) * this.size;
                const pz = (cz + 0.5 + jitterZ) * this.size;
                const dist = (loc.x - px) ** 2 + (loc.z - pz) ** 2;
                if (dist < best) {
                    best = dist;
                    chosenX = cx;
                    chosenZ = cz;
                }
            }
        }
        const index = Math.floor(geometricCellRandom(chosenX, chosenZ, 79) * patterns.length);
        return patterns[index].getPermutation(block, context);
    }

    toJSON() {
        return { type: "voronoi", settings: { size: this.size, jitter: this.jitter }, children: [this.nodes[0].toJSON()] };
    }
}
