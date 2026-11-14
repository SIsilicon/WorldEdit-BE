import { Vector3, BlockPermutation, Player } from "@minecraft/server";
import { Server, Vector } from "@notbeer-api";
import { Token } from "../extern/tokenizr.js";
import { BlockUnit, parsedBlock } from "../block_parsing.js";
import { Cardinal } from "../directions.js";
import { wrap } from "../../util.js";
import { Pattern } from "../pattern.js";
import { PatternNode, patternContext } from "./base.js";

export class BlockPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public permutation: BlockPermutation
    ) {
        super(token);
    }

    getPermutation() {
        return this.permutation;
    }

    toJSON() {
        return {
            type: "block",
            settings: {
                id: this.permutation.type.id,
                states: this.permutation.getAllStates(),
            },
        };
    }
}

export class VoidPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    getPermutation() {
        return <BlockPermutation>undefined;
    }

    toJSON() {
        return { type: "void" };
    }
}

export class TypePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    private permutation: BlockPermutation;
    private props: Record<string, string | number | boolean>;

    constructor(
        token: Token,
        public type: string
    ) {
        super(token);
    }

    prepare() {
        super.prepare();
        this.permutation = BlockPermutation.resolve(this.type);
        this.props = this.permutation.getAllStates();
    }

    getPermutation(block: BlockUnit): BlockPermutation {
        let permutation = this.permutation;
        Object.entries(block.permutation.getAllStates()).forEach(([state, val]) => {
            if (state in this.props) permutation = permutation.withState(<any>state, val);
        });
        return permutation;
    }

    toJSON() {
        return { type: "type", settings: { type: this.type } };
    }
}

export class StatePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public states: parsedBlock["states"]
    ) {
        super(token);
    }

    getPermutation(block: BlockUnit) {
        let permutation = block.permutation;
        const props = permutation.getAllStates();
        this.states.forEach((val, state) => {
            if (state in props) permutation = permutation.withState(<any>state, val);
        });
        return permutation;
    }

    toJSON() {
        return { type: "state", settings: { states: Object.fromEntries(this.states) } };
    }
}

export class RandStatePatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    private permutations: BlockPermutation[];

    constructor(token: Token, type: string) {
        super(token);
        this.type = type;
    }

    get type() {
        return this.permutations[0].type.id;
    }

    set type(value: string) {
        this.permutations = Array.from(Server.block.iteratePermutations(value));
    }

    getPermutation() {
        return this.permutations[Math.floor(Math.random() * this.permutations.length)];
    }

    toJSON() {
        return { type: "randstate", settings: { type: this.type } };
    }
}

export class ClipboardPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public offset: Vector3
    ) {
        super(token);
    }

    getPermutation(block: BlockUnit, context: patternContext) {
        const clipboard = context.session?.clipboard;
        const size = clipboard.getSize();
        const offset = Vector.sub(block.location, this.offset);
        const sampledLoc = new Vector(wrap(offset.x, size.x), wrap(offset.y, size.y), wrap(offset.z, size.z));
        return clipboard.getBlock(sampledLoc).permutation;
    }

    toJSON() {
        return {
            type: "clipboard",
            settings: { offset: [this.offset.x, this.offset.y, this.offset.z] },
        };
    }
}

export class HandPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(token: Token) {
        super(token);
    }

    getPermutation(_: BlockUnit, context: patternContext) {
        return context.hand;
    }

    toJSON() {
        return { type: "hand" };
    }
}

export class GradientPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    private axis: "x" | "y" | "z";
    private invertCoords: boolean;

    private radial = false;
    private radialOrigin: "center" | "placement" = "center";
    private lastContext: patternContext;

    constructor(
        token: Token,
        public gradientId: string,
        public cardinal: Cardinal | "radial" | "light" = new Cardinal()
    ) {
        super(token);
    }

    prepare() {
        this.radial = this.cardinal === "radial" || this.cardinal === "light";
        if (this.radial) this.radialOrigin = this.cardinal === "light" ? "placement" : "center";
        this.lastContext = undefined;
    }

    getPermutation(block: BlockUnit, context: patternContext) {
        const gradient = context.session.getGradient(this.gradientId);
        if (!gradient) return undefined;

        const patternLength = gradient.patterns.length;
        let index = 0;
        if (this.radial) {
            let center = context.getCenter(block.location);
            let maxLength = context.gradientRadius;
            if (this.radialOrigin !== "center") {
                const point = context.placePosition;
                const max = context.range[1];
                const min = context.range[0];
                // Determine which corner is farthest based on the relative position of the point to the center
                const farthestX = point.x < center.x ? max.x : min.x;
                const farthestY = point.y < center.y ? max.y : min.y;
                const farthestZ = point.z < center.z ? max.z : min.z;
                maxLength = point.distanceTo(new Vector(farthestX, farthestY, farthestZ));
                center = point;
            }
            index = Math.floor((center.distanceTo(block.location) / maxLength) * (patternLength - gradient.dither) + Math.random() * gradient.dither);
        } else {
            if (this.lastContext !== context) {
                this.updateCardinalDirectionParams(context.session.player);
                this.lastContext = context;
            }
            const unitCoords = Vector.sub(block.location, context.range[0]).div(context.range[1].sub(context.range[0]).max([1, 1, 1]));
            const direction = this.invertCoords ? 1.0 - unitCoords[this.axis] : unitCoords[this.axis];
            index = Math.floor(direction * (patternLength - gradient.dither) + Math.random() * gradient.dither);
        }
        return gradient.patterns[Math.min(Math.max(index, 0), patternLength - 1)].getRootNode().getPermutation(block, context);
    }

    private updateCardinalDirectionParams(player: Player) {
        const dir = (this.cardinal as Cardinal).getDirection(player);
        const absDir = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
        if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) this.axis = "x";
        else if (absDir[1] > absDir[0] && absDir[1] > absDir[2]) this.axis = "y";
        else this.axis = "z";
        this.invertCoords = dir[this.axis] < 0;
    }

    toJSON() {
        return { type: "gradient", settings: { gradientId: this.gradientId, cardinal: this.cardinal } };
    }
}

export class PercentPatternNode extends PatternNode {
    readonly prec = 2;
    readonly opCount = 1;

    constructor(
        token: Token,
        public percent: number
    ) {
        super(token);
    }

    getPermutation() {
        return undefined as BlockPermutation;
    }

    toJSON() {
        return { type: "percent", settings: { percent: this.percent }, children: [this.nodes[0].toJSON()] };
    }
}

export class InputPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    private node: PatternNode;

    constructor(
        token: Token,
        public input: string
    ) {
        super(token);
    }

    prepare() {
        this.node = new Pattern(this.input).getRootNode();
    }

    getPermutation(block: BlockUnit, context: patternContext) {
        return this.node.getPermutation(block, context);
    }

    toJSON() {
        return { type: "input", settings: { input: this.input } };
    }
}

export class ChainPatternNode extends PatternNode {
    readonly prec = 1;
    readonly opCount = 2;
    readonly variableOps = true;

    public evenDistribution = true;
    public hasExplicitWeights = false;

    private weights: (number | undefined)[] = [];
    private cumWeights: number[] = [];
    private weightTotal: number;

    constructor(token: Token, nodes: PatternNode[] = []) {
        super(token);
        this.nodes.push(...nodes);
    }

    getWeight(index: number) {
        const weight = this.weights?.[index];
        if (weight !== undefined) return weight;

        let specifiedTotal = 0;
        let unspecifiedCount = 0;

        for (let i = 0; i < this.nodes.length; i++) {
            const nodeWeight = this.weights?.[i];

            if (nodeWeight === undefined) {
                unspecifiedCount++;
            } else {
                specifiedTotal += nodeWeight;
            }
        }

        if (!unspecifiedCount) return 0;

        return Math.max(100 - specifiedTotal, 0) / unspecifiedCount;
    }

    setWeight(index: number, weight: number) {
        while (this.weights.length <= index) this.weights.push(undefined);
        this.weights[index] = weight;
    }

    removeWeight(index: number) {
        this.weights?.splice(index, 1);
    }

    prepare() {
        super.prepare();
        if (this.evenDistribution) return;

        this.cumWeights.length = 0;
        for (let i = 0; i < this.nodes.length; i++) this.cumWeights.push(this.getWeight(i) + (this.cumWeights[i - 1] || 0));
        this.weightTotal = this.cumWeights[this.cumWeights.length - 1];
    }

    getPermutation(block: BlockUnit, context: patternContext) {
        if (this.nodes.length === 1) {
            return this.nodes[0].getPermutation(block, context);
        } else if (this.evenDistribution) {
            return this.nodes[Math.floor(Math.random() * this.nodes.length)].getPermutation(block, context);
        } else {
            const rand = Math.random() * this.weightTotal;
            for (let i = 0; i < this.nodes.length; i++) {
                if (this.cumWeights[i] >= rand) return this.nodes[i].getPermutation(block, context);
            }
        }
    }

    optimize() {
        super.optimize();
        const patterns = this.nodes;
        this.nodes = [];
        while (patterns.length) {
            const pattern = patterns.shift();
            if (pattern instanceof PercentPatternNode) {
                this.evenDistribution = false;
                this.hasExplicitWeights = true;
                this.nodes.push(pattern.nodes[0]);
                this.weights.push(pattern.percent);
            } else {
                this.nodes.push(pattern);
                this.weights.push(undefined);
            }
        }

        const reduced: { [patternJson: string]: [node: PatternNode, weight: number] } = {};
        for (let i = 0; i < this.nodes.length; i++) {
            const json = JSON.stringify(this.nodes[i].toJSON());
            reduced[json] ??= [this.nodes[i], 0];
            reduced[json][1] += this.getWeight(i);
        }

        const reducedList = Object.values(reduced);
        if (reducedList.length < this.nodes.length) {
            this.evenDistribution = false;
            this.nodes.length = 0;
            this.weights.length = 0;
            for (const [node, weight] of reducedList) {
                this.nodes.push(node);
                this.weights.push(weight);
            }
        }
    }

    toJSON() {
        return {
            type: "chain",
            settings: { explicitNoiseWeights: this.hasExplicitWeights },
            children: this.nodes.map((node, i) => {
                if (!this.evenDistribution && this.weights[i] !== undefined) {
                    const percentNode = new PercentPatternNode(null, this.weights[i]);
                    percentNode.nodes.push(node);
                    return percentNode.toJSON();
                } else {
                    return node.toJSON();
                }
            }),
        };
    }
}
