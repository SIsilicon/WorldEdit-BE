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
