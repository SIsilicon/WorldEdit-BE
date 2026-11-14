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
