import { Vector3, BlockPermutation, Player, Dimension, BlockVolumeBase } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector, Server, whenReady, regionIterateBlocks } from "@notbeer-api";
import { PlayerSession } from "server/sessions.js";
import { wrap } from "server/util.js";
import { Token } from "./extern/tokenizr.js";
import {
    tokenize,
    throwTokenError,
    mergeTokens,
    parseBlock,
    parsedBlock,
    parseBlockStates,
    AstNode,
    processOps,
    parseNumberList,
    blockPermutation2ParsedBlock,
    parsedBlock2BlockPermutation,
    BlockUnit,
} from "./block_parsing.js";
import { Cardinal } from "./directions.js";
import { Mask } from "./mask.js";
import { buildKDTree } from "library/utils/kdtree.js";

interface patternContext {
    session: PlayerSession;
    hand: BlockPermutation;
    range: [Vector, Vector];
    getCenter: (location: Vector3) => Vector;
    gradientRadius: number;
    placePosition: Vector;
    cardinal: Cardinal;
}

export interface patternContextOptions {
    strokePoints?: Vector3[];
    gradientRadius?: number;
}

export class Pattern implements CustomArgType {
    private block: PatternNode;
    private stringObj = "";
    private simpleCache: BlockPermutation;

    private context = {} as patternContext;

    constructor(pattern = "") {
        if (!pattern) return;
        whenReady(() => {
            const obj = Pattern.parseArgs([pattern]).result;
            this.block = obj.block;
            this.stringObj = obj.stringObj;
        });
    }

    withContext(session: PlayerSession, range: [Vector3, Vector3], options?: patternContextOptions) {
        const pattern = this.clone();
        pattern.context.session = session;
        pattern.context.range = [Vector.from(range[0]), Vector.from(range[1])];
        pattern.context.cardinal = new Cardinal(Cardinal.Dir.FORWARD);
        pattern.context.placePosition = session.getPlacementPosition();
        pattern.context.gradientRadius = options?.gradientRadius ?? Vector.sub(range[1], range[0]).length / 2;
        try {
            const item = Server.player.getHeldItem(session.player);
            pattern.context.hand = Server.block.itemToPermutation(item);
        } catch {
            pattern.context.hand = BlockPermutation.resolve("minecraft:air");
        }

        const centers = (options?.strokePoints ?? [Vector.add(...range).div(2)]).map(Vector.from);
        if (centers.length > 32) {
            // KD Tree
            const kdRoot = buildKDTree(centers);
            pattern.context.getCenter = (location: Vector3) => {
                const nearest = kdRoot.nearest(location);
                return Vector.from(nearest ?? centers[0]);
            };
        } else {
            // Linear Search
            pattern.context.getCenter = (location: Vector3) => {
                const locV = Vector.from(location);
                let closest = centers[0];
                let minDist = locV.distanceTo(closest);
                for (let i = 1; i < centers.length; i++) {
                    const c = centers[i];
                    const d = locV.distanceTo(c);
                    if (d < minDist) {
                        minDist = d;
                        closest = c;
                    }
                }
                return Vector.from(closest);
            };
        }

        pattern.getRootNode().prepare();
        return pattern;
    }

    /**
     * Replaces a block with this pattern
     * @param block
     * @returns True if the block changed; false otherwise
     */
    setBlock(block: BlockUnit) {
        try {
            const oldBlock = block.permutation;
            const newBlock = this.block.getPermutation(block, this.context);
            if (!newBlock) return false;
            block.setPermutation(newBlock);
            return !oldBlock.matches(block.typeId);
        } catch (err) {
            // console.error(err);
            return false;
        }
    }

    getRootNode() {
        return this.block;
    }

    clear() {
        this.block = null;
        this.stringObj = "";
        this.simpleCache = undefined;
    }

    empty() {
        return this.block == null;
    }

    addBlock(permutation: BlockPermutation) {
        if (!this.block) {
            this.block = new ChainPatternNode(null);
        } else if (!(this.block instanceof ChainPatternNode)) {
            const old = this.block;
            this.block = new ChainPatternNode(null);
            this.block.nodes.push(old);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.block.nodes.push(new BlockPatternNode(null, parsedBlock2BlockPermutation(block)));

        if (this.stringObj) this.stringObj += ",";
        this.stringObj += block.id.replace("minecraft:", "");
        if (block.states.size) this.stringObj += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
        this.simpleCache = undefined;
    }

    toJSON() {
        return this.stringObj;
    }

    isSimple() {
        return this.block instanceof BlockPatternNode || (this.block instanceof ChainPatternNode && this.block.nodes.length == 1 && this.block.nodes[0] instanceof BlockPatternNode);
    }

    fillBlocks(dimension: Dimension, volume: BlockVolumeBase, mask?: Mask) {
        const filter = mask?.getSimpleBlockFilter();
        if (this.isSimple()) {
            if (!this.simpleCache) {
                if (this.block instanceof BlockPatternNode) {
                    this.simpleCache = this.block.permutation;
                } else if (this.block instanceof ChainPatternNode) {
                    this.simpleCache = (this.block.nodes[0] as BlockPatternNode).permutation;
                }
            }
            return dimension.fillBlocks(volume, this.simpleCache, { blockFilter: filter }).getCapacity();
        } else {
            let count = 0;
            volume = dimension.getBlocks(volume, filter);
            for (const block of volume.getBlockLocationIterator()) {
                count += this.setBlock(dimension.getBlock(block)) ? 1 : 0;
            }
            return count;
        }
    }

    clone() {
        const pattern = new Pattern();
        pattern.block = this.block;
        pattern.stringObj = this.stringObj;
        return pattern;
    }

    toString() {
        return `[pattern: ${this.stringObj}]`;
    }

    static parseArgs(args: Array<string>, index = 0) {
        const input = args[index];
        if (!input) {
            return { result: new Pattern(), argIndex: index + 1 };
        }

        const tokens = tokenize(input);
        let token: Token;

        function processTokens(inBracket: boolean) {
            const ops: PatternNode[] = [];
            const out: PatternNode[] = [];
            const start = tokens.curr();

            function nodeToken() {
                return mergeTokens(token, tokens.curr(), input);
            }

            // eslint-disable-next-line no-cond-assign
            while ((token = tokens.next())) {
                if (token.value === "void") {
                    out.push(new VoidPatternNode(nodeToken()));
                } else if (token.type == "id") {
                    out.push(new BlockPatternNode(nodeToken(), parsedBlock2BlockPermutation(parseBlock(tokens, input, false) as parsedBlock)));
                } else if (token.type == "number") {
                    const num = token;
                    const t = tokens.next();
                    if (t.value == "%") {
                        processOps(out, ops, new PercentPatternNode(nodeToken(), num.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == ",") {
                    processOps(out, ops, new ChainPatternNode(nodeToken()));
                } else if (token.value == "^") {
                    const t = tokens.next();
                    if (t.type == "id") {
                        out.push(new TypePatternNode(nodeToken(), parseBlock(tokens, input, true) as string));
                    } else if (t.value == "[") {
                        out.push(new StatePatternNode(nodeToken(), parseBlockStates(tokens)));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == "*") {
                    const t = tokens.next();
                    if (t.type != "id") {
                        throwTokenError(t);
                    }
                    out.push(new RandStatePatternNode(nodeToken(), parseBlock(tokens, input, true) as string));
                } else if (token.value == "$") {
                    const t = tokens.next();
                    let cardinal: Cardinal | "radial" | "light";
                    if (t.type != "id") throwTokenError(t);
                    if (tokens.peek().value == ".") {
                        tokens.next();
                        const d: string = tokens.next()?.value;
                        cardinal = d === "rad" ? "radial" : d === "lit" ? "light" : Cardinal.parseArgs([d]).result;
                    }

                    out.push(new GradientPatternNode(nodeToken(), t.value, cardinal));
                } else if (token.value == "#") {
                    const t = tokens.next();
                    if (t.value == "clipboard") {
                        let offset = Vector.ZERO;
                        if (tokens.peek()?.value == "@") {
                            tokens.next();
                            if (tokens.next().value != "[") throwTokenError(tokens.curr());
                            const array = parseNumberList(tokens, 3);
                            offset = Vector.from(array as [number, number, number]);
                        }
                        out.push(new ClipboardPatternNode(nodeToken(), offset.floor()));
                    } else if (t.value == "hand") {
                        out.push(new HandPatternNode(nodeToken()));
                    } else if (t.value.match?.(/blob[1-9][0-9]*/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BlobPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(4))));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.type == "bracket") {
                    if (token.value == "(") {
                        out.push(processTokens(true));
                    } else if (token.value == ")") {
                        if (!inBracket) {
                            throwTokenError(token);
                        } else {
                            processOps(out, ops);
                            break;
                        }
                    } else {
                        throwTokenError(token);
                    }
                } else if (token.type == "EOF") {
                    if (inBracket) {
                        throwTokenError(token);
                    } else {
                        processOps(out, ops);
                    }
                } else {
                    throwTokenError(token);
                }
            }

            if (out.length > 1) {
                throwTokenError(out.slice(-1)[0].token);
            } else if (!out.length) {
                throwTokenError(start);
            } else if (ops.length) {
                const op = ops.slice(-1)[0];
                throwTokenError(op instanceof Token ? op : op.token);
            }

            return out[0];
        }

        let out: PatternNode;
        try {
            out = processTokens(false);
            out.optimize();
        } catch (error) {
            if (error.pos != undefined) {
                const err: commandSyntaxError = {
                    isSyntaxError: true,
                    idx: index,
                    start: error.pos,
                    end: error.pos + 1,
                    stack: error.stack,
                };
                throw err;
            }
            throw error;
        }

        const pattern = new Pattern();
        pattern.stringObj = args[index];
        pattern.block = out;

        return { result: pattern, argIndex: index + 1 };
    }

    static fromNode(node: PatternNode) {
        const pattern = new Pattern();
        pattern.block = node;
        return pattern;
    }
}

type NodeJSON = { type: string; nodes: NodeJSON[] };
export abstract class PatternNode implements AstNode {
    public nodes: PatternNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    prepare() {
        for (const node of this.nodes) node.prepare();
    }

    abstract getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined;

    optimize() {
        for (const node of this.nodes) node.optimize();
    }

    /** Debug only! Not all important data is represented. */
    toJSON(): NodeJSON {
        return {
            type: this.constructor.name,
            nodes: this.nodes.map((n) => n.toJSON()),
        };
    }
}

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
}

export class VoidPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    getPermutation() {
        return <BlockPermutation>undefined;
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
}

export class GradientPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    private axis: "x" | "y" | "z";
    private invertCoords: boolean;

    private radial = false;
    private radialOrigin: "center" | "placement" = "center";
    private ctxCardinal: Cardinal;

    constructor(
        token: Token,
        public gradientId: string,
        public cardinal?: Cardinal | "radial" | "light"
    ) {
        super(token);
        const isRadial = cardinal === "radial" || cardinal === "light";
        if (cardinal && !isRadial) this.updateDirectionParams(cardinal);
        if (isRadial) {
            this.radial = true;
            if (cardinal === "light") this.radialOrigin = "placement";
        }
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
            if (!this.cardinal && this.ctxCardinal !== context.cardinal) {
                this.updateDirectionParams(context.cardinal, context.session.player);
                this.ctxCardinal = context.cardinal;
            }
            const unitCoords = Vector.sub(block.location, context.range[0]).div(context.range[1].sub(context.range[0]).max([1, 1, 1]));
            const direction = this.invertCoords ? 1.0 - unitCoords[this.axis] : unitCoords[this.axis];
            index = Math.floor(direction * (patternLength - gradient.dither) + Math.random() * gradient.dither);
        }
        return gradient.patterns[Math.min(Math.max(index, 0), patternLength - 1)].getRootNode().getPermutation(block, context);
    }

    private updateDirectionParams(cardinal: Cardinal, player?: Player) {
        const dir = cardinal.getDirection(player);
        const absDir = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
        if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) {
            this.axis = "x";
        } else if (absDir[1] > absDir[0] && absDir[1] > absDir[2]) {
            this.axis = "y";
        } else {
            this.axis = "z";
        }
        this.invertCoords = dir[this.axis] < 0;
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
        return null as BlockPermutation;
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
}

export class BlobPatternNode extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private offsets: Vector[] = [];
    private perms: { [key: number]: BlockPermutation } = {};
    private ranges: { [key: number]: { range: [Vector, Vector] } } = {};
    private points: { [key: number]: Vector } = {};

    private isRadial = false;

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
        this.isRadial = this.nodes[0] instanceof GradientPatternNode && this.nodes[0].cardinal === "radial";
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
            return this.nodes[0].getPermutation(block, { ...context, gradientRadius: subGradientRadius });
        } else {
            if (!(closestCell in this.perms)) this.perms[closestCell] = this.nodes[0].getPermutation(block, context);
            return this.perms[closestCell];
        }
    }

    private randomNum() {
        return Math.random() * (this.size - 1);
    }
}

export class ChainPatternNode extends PatternNode {
    readonly prec = 1;
    readonly opCount = 2;
    readonly variableOps = true;

    public evenDistribution = true;

    private weights: number[] | undefined;
    private cumWeights: number[] = [];
    private weightTotal: number;

    constructor(token: Token, nodes: PatternNode[] = []) {
        super(token);
        this.nodes.push(...nodes);
    }

    getWeight(index: number) {
        return this.weights?.[index] ?? 1 / this.nodes.length;
    }

    setWeight(index: number, weight: number) {
        this.weights ??= [];
        this.weights.length = Math.max(this.weights.length, index + 1);
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
        const defaultWeight = 1 / this.nodes.length;
        let totalWeight = 0;

        const patterns = this.nodes;
        const weights = [];
        this.nodes = [];
        while (patterns.length) {
            const pattern = patterns.shift();
            if (pattern instanceof PercentPatternNode) {
                this.evenDistribution = false;
                this.nodes.push(pattern.nodes[0]);
                weights.push(pattern.percent / 100);
                totalWeight += pattern.percent / 100;
            } else {
                this.nodes.push(pattern);
                weights.push(defaultWeight);
                totalWeight += defaultWeight;
            }
        }
        this.weights ??= weights.map((value) => value / totalWeight);
    }
}
