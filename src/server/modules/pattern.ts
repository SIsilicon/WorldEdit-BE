import { Vector3, BlockPermutation, Player, Dimension, BlockVolume } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector, Server } from "@notbeer-api";
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

interface patternContext {
    session: PlayerSession;
    hand: BlockPermutation;
    range: [Vector, Vector];
    placePosition: Vector;
    cardinal: Cardinal;
}

export class Pattern implements CustomArgType {
    private block: PatternNode;
    private stringObj = "";
    private simpleCache: BlockPermutation;

    private context = {} as patternContext;

    constructor(pattern = "") {
        if (pattern) {
            const obj = Pattern.parseArgs([pattern]).result;
            this.block = obj.block;
            this.stringObj = obj.stringObj;
        }
    }

    withContext(session: PlayerSession, range: [Vector3, Vector3]) {
        const pattern = this.clone();
        pattern.context.session = session;
        pattern.context.range = [Vector.from(range[0]), Vector.from(range[1])];
        pattern.context.cardinal = new Cardinal(Cardinal.Dir.FORWARD);
        pattern.context.placePosition = session.getPlacementPosition();
        try {
            const item = Server.player.getHeldItem(session.getPlayer());
            pattern.context.hand = Server.block.itemToPermutation(item);
        } catch {
            pattern.context.hand = BlockPermutation.resolve("minecraft:air");
        }
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
            this.block = new ChainPattern(null);
        } else if (!(this.block instanceof ChainPattern)) {
            const old = this.block;
            this.block = new ChainPattern(null);
            this.block.nodes.push(old);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.block.nodes.push(new BlockPattern(null, block));

        if (this.stringObj) this.stringObj += ",";
        this.stringObj += block.id.replace("minecraft:", "");
        if (block.states.size) this.stringObj += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
        this.simpleCache = undefined;
    }

    getBlockSummary() {
        let text = "";
        const blockMap = new Map<string, number>();
        for (const pattern of this.block.nodes) {
            let sub = (<BlockPattern>pattern).block.id.replace("minecraft:", "");
            for (const state of (<BlockPattern>pattern).block.states) {
                const val = state[1];
                if (typeof val == "string" && val != "x" && val != "y" && val != "z") {
                    sub += `(${val})`;
                    break;
                }
            }
            if (blockMap.has(sub)) {
                blockMap.set(sub, blockMap.get(sub) + 1);
            } else {
                blockMap.set(sub, 1);
            }
        }

        let i = 0;
        for (const block of blockMap) {
            if (block[1] > 1) {
                text += `${block[1]}x ${block[0]}`;
            } else {
                text += block[0];
            }
            if (i < blockMap.size - 1) text += ", ";
            i++;
        }
        return text;
    }

    toJSON() {
        return this.stringObj;
    }

    isSimple() {
        return this.block instanceof BlockPattern || (this.block instanceof ChainPattern && this.block.nodes.length == 1 && this.block.nodes[0] instanceof BlockPattern);
    }

    fillSimpleArea(dimension: Dimension, start: Vector3, end: Vector3, mask?: Mask) {
        if (!this.simpleCache) {
            if (this.block instanceof BlockPattern) {
                this.simpleCache = parsedBlock2BlockPermutation(this.block.block);
            } else if (this.block instanceof ChainPattern) {
                this.simpleCache = parsedBlock2BlockPermutation((<BlockPattern>this.block.nodes[0]).block);
            }
        }
        return dimension.fillBlocks(new BlockVolume(start, end), this.simpleCache, { blockFilter: mask?.getSimpleBlockFilter() }).getCapacity();
    }

    getSimpleBlockFill() {
        if (this.block instanceof BlockPattern) {
            return parsedBlock2BlockPermutation(this.block.block);
        } else if (this.block instanceof ChainPattern && this.block.nodes.length == 1 && this.block.nodes[0] instanceof BlockPattern) {
            return parsedBlock2BlockPermutation(this.block.nodes[0].block);
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
                    out.push(new VoidPattern(nodeToken()));
                } else if (token.type == "id") {
                    out.push(new BlockPattern(nodeToken(), parseBlock(tokens, input, false) as parsedBlock));
                } else if (token.type == "number") {
                    const num = token;
                    const t = tokens.next();
                    if (t.value == "%") {
                        processOps(out, ops, new PercentPattern(nodeToken(), num.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == ",") {
                    processOps(out, ops, new ChainPattern(token));
                } else if (token.value == "^") {
                    const t = tokens.next();
                    if (t.type == "id") {
                        out.push(new TypePattern(nodeToken(), parseBlock(tokens, input, true) as string));
                    } else if (t.value == "[") {
                        out.push(new StatePattern(nodeToken(), parseBlockStates(tokens)));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == "*") {
                    const t = tokens.next();
                    if (t.type != "id") {
                        throwTokenError(t);
                    }
                    out.push(new RandStatePattern(nodeToken(), parseBlock(tokens, input, true) as string));
                } else if (token.value == "$") {
                    const t = tokens.next();
                    let cardinal: Cardinal | "radial" | "light";
                    if (t.type != "id") throwTokenError(t);
                    if (tokens.peek().value == ".") {
                        tokens.next();
                        const d: string = tokens.next()?.value;
                        cardinal = d === "rad" ? "radial" : d === "lit" ? "light" : Cardinal.parseArgs([d]).result;
                    }

                    out.push(new GradientPattern(nodeToken(), t.value, cardinal));
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
                        out.push(new ClipboardPattern(nodeToken(), offset.floor()));
                    } else if (t.value == "hand") {
                        out.push(new HandPattern(nodeToken()));
                    } else if (t.value.match?.(/blob[1-9][0-9]*/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BlobPattern(nodeToken(), Number.parseInt((<string>t.value).slice(4))));
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
            out.postProcess();
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
}

type NodeJSON = { type: string; nodes: NodeJSON[] };
abstract class PatternNode implements AstNode {
    public nodes: PatternNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    abstract getPermutation(block: BlockUnit, context: patternContext): BlockPermutation | undefined;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() {}

    /** Debug only! Not all important data is represented. */
    toJSON(): NodeJSON {
        return {
            type: this.constructor.name,
            nodes: this.nodes.map((n) => n.toJSON()),
        };
    }
}

class BlockPattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    readonly permutation: BlockPermutation;

    constructor(
        token: Token,
        public block: parsedBlock
    ) {
        super(token);
        this.permutation = parsedBlock2BlockPermutation(block);
    }

    getPermutation() {
        return this.permutation;
    }
}

class VoidPattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    getPermutation() {
        return <BlockPermutation>undefined;
    }
}

class TypePattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    readonly permutation: BlockPermutation;
    readonly props: Record<string, string | number | boolean>;

    constructor(
        token: Token,
        public type: string
    ) {
        super(token);
        this.permutation = BlockPermutation.resolve(type);
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

class StatePattern extends PatternNode {
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

class RandStatePattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;
    readonly permutations: BlockPermutation[];

    constructor(
        token: Token,
        public block: string
    ) {
        super(token);
        this.permutations = Array.from(Server.block.iteratePermutations(this.block));
    }

    getPermutation() {
        return this.permutations[Math.floor(Math.random() * this.permutations.length)];
    }
}

class ClipboardPattern extends PatternNode {
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
        if (clipboard?.isAccurate) {
            const size = clipboard.getSize();
            const offset = Vector.sub(block.location, this.offset);
            const sampledLoc = new Vector(wrap(size.x, offset.x), wrap(size.y, offset.y), wrap(size.z, offset.z));
            return clipboard.getBlock(sampledLoc);
        }
    }
}

class HandPattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(token: Token) {
        super(token);
    }

    getPermutation(_: BlockUnit, context: patternContext) {
        return context.hand;
    }
}

class GradientPattern extends PatternNode {
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
        if (gradient) {
            const patternLength = gradient.patterns.length;
            let index = 0;
            if (this.radial) {
                let center = context.range[0].lerp(context.range[1], 0.5);
                let maxLength;
                if (this.radialOrigin === "center") {
                    maxLength = context.range[1].distanceTo(context.range[0]) / 2;
                } else {
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
                    this.updateDirectionParams(context.cardinal, context.session.getPlayer());
                    this.ctxCardinal = context.cardinal;
                }
                const unitCoords = Vector.sub(block.location, context.range[0]).div(context.range[1].sub(context.range[0]).max([1, 1, 1]));
                const direction = this.invertCoords ? 1.0 - unitCoords[this.axis] : unitCoords[this.axis];
                index = Math.floor(direction * (patternLength - gradient.dither) + Math.random() * gradient.dither);
            }
            return gradient.patterns[Math.min(Math.max(index, 0), patternLength - 1)].getRootNode().getPermutation(block, context);
        }
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

class PercentPattern extends PatternNode {
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

class BlobPattern extends PatternNode {
    readonly prec = -1;
    readonly opCount = 1;

    private readonly offsets: Vector[] = [];
    private perms: { [key: number]: BlockPermutation } = {};
    private ranges: { [key: number]: { range: [Vector, Vector] } } = {};
    private points: { [key: number]: Vector } = {};

    private isRadial = false;

    constructor(
        token: Token,
        public readonly size: number
    ) {
        super(token);
        this.offsets = [];
        for (let z = -1; z <= 1; z++) {
            for (let y = -1; y <= 1; y++) {
                for (let x = -1; x <= 1; x++) {
                    this.offsets.push(new Vector(x * this.size, y * this.size, z * this.size));
                }
            }
        }
    }

    postProcess() {
        this.nodes[0].postProcess();
        this.isRadial = this.nodes[0] instanceof GradientPattern && this.nodes[0].cardinal === "radial";
        this.perms = {};
        this.ranges = {};
        this.points = {};
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
            return this.nodes[0].getPermutation(block, { ...context, ...this.ranges[closestCell] });
        } else {
            if (!(closestCell in this.perms)) this.perms[closestCell] = this.nodes[0].getPermutation(block, context);
            return this.perms[closestCell];
        }
    }

    private randomNum() {
        return Math.random() * (this.size - 1);
    }
}

class ChainPattern extends PatternNode {
    readonly prec = 1;
    readonly opCount = 2;

    private evenDistribution = true;
    private cumWeights: number[] = [];
    private weightTotal: number;

    getPermutation(block: BlockUnit, context: patternContext) {
        if (this.nodes.length == 1) {
            return this.nodes[0].getPermutation(block, context);
        } else if (this.evenDistribution) {
            return this.nodes[Math.floor(Math.random() * this.nodes.length)].getPermutation(block, context);
        } else {
            const rand = Math.random() * this.weightTotal;
            for (let i = 0; i < this.nodes.length; i++) {
                if (this.cumWeights[i] >= rand) {
                    return this.nodes[i].getPermutation(block, context);
                }
            }
        }
    }

    postProcess() {
        super.postProcess();

        const defaultPercent = 100 / this.nodes.length;
        let totalPercent = 0;

        const patterns = this.nodes;
        const weights = [];
        this.nodes = [];
        while (patterns.length) {
            const pattern = patterns.shift();
            if (pattern instanceof ChainPattern) {
                const sub = pattern.nodes.reverse();
                for (const child of sub) {
                    patterns.unshift(child);
                }
            } else if (pattern instanceof PercentPattern) {
                this.evenDistribution = false;
                this.nodes.push(pattern.nodes[0]);
                weights.push(pattern.percent);
                pattern.nodes[0].postProcess();
                totalPercent += pattern.percent;
            } else {
                this.nodes.push(pattern);
                weights.push(defaultPercent);
                pattern.postProcess();
                totalPercent += defaultPercent;
            }
        }
        weights.map((value) => {
            // printDebug(value / totalPercent);
            return value / totalPercent;
        });

        if (!this.evenDistribution) {
            for (let i = 0; i < weights.length; i += 1) {
                this.cumWeights.push(weights[i] + (this.cumWeights[i - 1] || 0));
            }
            this.weightTotal = this.cumWeights[this.cumWeights.length - 1];
        }
    }
}
