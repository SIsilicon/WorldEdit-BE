import { Vector3, BlockPermutation, Player, Dimension, BlockVolumeBase } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector, Server, whenReady, regionIterateBlocks, regionSize } from "@notbeer-api";
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
import { Cardinal, CardinalDirection } from "./directions.js";
import { Mask } from "./mask.js";
import { closestPoint } from "library/utils/closestpoint.js";
import { Selection } from "./selection.js";
import { Noise } from "./noise.js";

interface patternContext {
    session: PlayerSession;
    hand: BlockPermutation;
    range: [Vector, Vector];
    getCenter: (location: Vector3) => Vector;
    gradientRadius: number;
    placePosition: Vector;
    cardinal: Cardinal;
}

interface patternNodeJSON {
    type: string;
    settings?: any;
    children?: patternNodeJSON[];
}

export interface patternContextOptions {
    strokePoints?: Vector3[];
    gradientRadius?: number;
}

export class Pattern implements CustomArgType {
    private block: PatternNode;
    private stringSource = undefined;
    private simpleCache: BlockPermutation;

    private context = {} as patternContext;

    constructor(pattern: string | patternNodeJSON = "") {
        if (!pattern) return;
        whenReady(() => {
            const obj = typeof pattern === "string" ? Pattern.parseArgs([pattern]).result : Pattern.parseJSON(pattern);
            this.block = obj.block;
            this.stringSource = obj.stringSource;
        });
    }

    withContext(session: PlayerSession, range: [Vector3, Vector3], options?: patternContextOptions) {
        const pattern = this.clone();
        pattern.context.session = session;
        pattern.context.range = [Vector.from(range[0]), Vector.from(range[1])];
        pattern.context.cardinal = new Cardinal(CardinalDirection.Forward);
        pattern.context.placePosition = session.getPlacementPosition();
        pattern.context.gradientRadius = options?.gradientRadius ?? Vector.sub(range[1], range[0]).length / 2;
        const item = Server.player.getHeldItem(session.player);
        pattern.context.hand = item ? Server.block.itemToPermutation(item) : BlockPermutation.resolve("air");

        const centers = (options?.strokePoints ?? [Vector.add(...range).div(2)]).map(Vector.from);
        pattern.context.getCenter = closestPoint(centers);

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
        this.block = undefined;
        this.stringSource = this.stringSource ? "" : undefined;
        this.simpleCache = undefined;
    }

    empty() {
        return !this.block;
    }

    addBlock(permutation: BlockPermutation) {
        if (!this.block) {
            this.block = new ChainPatternNode(undefined);
        } else if (!(this.block instanceof ChainPatternNode)) {
            const old = this.block;
            this.block = new ChainPatternNode(undefined);
            this.block.nodes.push(old);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.block.nodes.push(new BlockPatternNode(undefined, parsedBlock2BlockPermutation(block)));

        if (this.stringSource) {
            this.stringSource += ",";
            this.stringSource += block.id.replace("minecraft:", "");
            if (block.states.size) this.stringSource += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
        }
        this.simpleCache = undefined;
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

    optimize() {
        this.block.optimize();
    }

    clone() {
        const pattern = new Pattern();
        pattern.block = this.block;
        pattern.stringSource = this.stringSource;
        return pattern;
    }

    convertToJSON() {
        this.stringSource = undefined;
    }

    toJSON() {
        return this.stringSource ?? this.block?.toJSON() ?? "";
    }

    toString() {
        return `[pattern: ${this.stringSource ?? JSON.stringify(this.block)}]`;
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

            function parseNoiseParams(defaults: number[], validators: ((value: number) => boolean)[] = []) {
                const values = [...defaults];
                let index = 0;

                while (tokens.peek()?.value == ":") {
                    const colon = tokens.next();
                    if (index >= defaults.length) throwTokenError(colon);

                    const valueToken = tokens.next();
                    if (!valueToken || valueToken.type != "number") throwTokenError(valueToken ?? colon);

                    const value = valueToken.value as number;
                    if (validators[index] && !validators[index](value)) throwTokenError(valueToken);

                    values[index] = value;
                    index++;
                }

                return values;
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
                    } else if (t.value.match?.(/^blob[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new BlobPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(4))));
                    } else if (t.value.match?.(/^perlin[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new PerlinPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6))));
                    } else if (t.value.match?.(/^cracked[1-9][0-9]*$/)) {
                        const [thickness] = parseNoiseParams([1], [(value) => value >= 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new CrackedPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(7)), thickness));
                    } else if (t.value.match?.(/^wood[1-9][0-9]*$/)) {
                        const [bands] = parseNoiseParams([10], [(value) => value > 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new WoodPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(4)), bands));
                    } else if (t.value.match?.(/^turbulence[1-9][0-9]*$/)) {
                        const [octaves, persistence, lacunarity] = parseNoiseParams(
                            [4, 0.5, 2],
                            [(value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new TurbulencePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(10)), octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^marble[1-9][0-9]*$/)) {
                        const [bands, distortion, octaves, persistence, lacunarity] = parseNoiseParams(
                            [1, 8, 4, 0.5, 2],
                            [(value) => value > 0, (value) => value >= 0, (value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new MarblePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6)), bands, distortion, octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^fbm[1-9][0-9]*$/)) {
                        const [octaves, persistence, lacunarity] = parseNoiseParams(
                            [4, 0.5, 2],
                            [(value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new FbmPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(3)), octaves, persistence, lacunarity));
                    } else if (t.value.match?.(/^veins[1-9][0-9]*$/)) {
                        const [width] = parseNoiseParams([0.1], [(value) => value >= 0 && value <= 1]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new VeinsPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(5)), width));
                    } else if (t.value.match?.(/^warped[1-9][0-9]*$/)) {
                        const [strength] = parseNoiseParams([1.5], [(value) => value >= 0]);
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new WarpedPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(6)), strength));
                    } else if (t.value.match?.(/^simplex[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new SimplexPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(7))));
                    } else if (t.value.match?.(/^value[1-9][0-9]*$/)) {
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new ValuePatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(5))));
                    } else if (t.value.match?.(/^pingpong[1-9][0-9]*$/)) {
                        const [strength, octaves, persistence, lacunarity] = parseNoiseParams(
                            [2, 4, 0.5, 2],
                            [(value) => value > 0, (value) => Number.isInteger(value) && value >= 1, (value) => value >= 0 && value <= 1, (value) => value > 0]
                        );
                        if (tokens.peek()?.value != "(") throwTokenError(tokens.peek());
                        processOps(out, ops, new PingPongPatternNode(nodeToken(), Number.parseInt((<string>t.value).slice(8)), strength, octaves, persistence, lacunarity));
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
        pattern.stringSource = args[index];
        pattern.block = out;

        return { result: pattern, argIndex: index + 1 };
    }

    static parseJSON(json: patternNodeJSON): Pattern {
        function buildNode({ type, settings, children }: patternNodeJSON): PatternNode {
            let node!: PatternNode;
            switch (type) {
                case "block":
                    node = new BlockPatternNode(null, BlockPermutation.resolve(settings.id, settings.states));
                    break;
                case "void":
                    node = new VoidPatternNode(null);
                    break;
                case "type":
                    node = new TypePatternNode(null, settings.type);
                    break;
                case "state":
                    node = new StatePatternNode(null, new Map(Object.entries(settings.states)));
                    break;
                case "randstate":
                    node = new RandStatePatternNode(null, settings.type);
                    break;
                case "clipboard":
                    node = new ClipboardPatternNode(null, Vector.from(settings.offset));
                    break;
                case "hand":
                    node = new HandPatternNode(null);
                    break;
                case "gradient":
                    node = new GradientPatternNode(
                        null, //
                        settings.gradientId,
                        settings.cardinal in CardinalDirection ? new Cardinal(settings.cardinal) : settings.cardinal
                    );
                    break;
                case "percent":
                    node = new PercentPatternNode(null, settings.percent);
                    break;
                case "input":
                    node = new InputPatternNode(null, settings.input);
                    break;
                case "blob":
                    node = new BlobPatternNode(null, settings.size);
                    break;
                case "perlin":
                    node = new PerlinPatternNode(null, settings.size);
                    break;
                case "cracked":
                    node = new CrackedPatternNode(null, settings.size, settings.thickness ?? 1);
                    break;
                case "wood":
                    node = new WoodPatternNode(null, settings.size, settings.bands ?? 10);
                    break;
                case "turbulence":
                    node = new TurbulencePatternNode(null, settings.size, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "marble":
                    node = new MarblePatternNode(null, settings.size, settings.bands ?? 1, settings.distortion ?? 8, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "fbm":
                    node = new FbmPatternNode(null, settings.size, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "veins":
                    node = new VeinsPatternNode(null, settings.size, settings.width ?? 0.1);
                    break;
                case "warped":
                    node = new WarpedPatternNode(null, settings.size, settings.strength ?? 1.5);
                    break;
                case "simplex":
                    node = new SimplexPatternNode(null, settings.size);
                    break;
                case "value":
                    node = new ValuePatternNode(null, settings.size);
                    break;
                case "pingpong":
                    node = new PingPongPatternNode(null, settings.size, settings.strength ?? 2, settings.octaves ?? 4, settings.persistence ?? 0.5, settings.lacunarity ?? 2);
                    break;
                case "chain":
                    node = new ChainPatternNode(null);
                    break;
                default:
                    throw new Error(`Unknown pattern type: ${type}`);
            }

            if (children) node.nodes = children.map((child) => buildNode(child));
            return node;
        }

        const pattern = new Pattern();
        pattern.block = buildNode(json);
        pattern.block.optimize();
        return pattern;
    }

    static fromNode(node: PatternNode) {
        const pattern = new Pattern();
        pattern.block = node;
        return pattern;
    }
}

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

    abstract toJSON(): patternNodeJSON;
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

function collectEvenPatternNodes(node: PatternNode): PatternNode[] {
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

function getPatternFromValue(patterns: PatternNode[], value: number) {
    const clamped = Math.min(Math.max(value, 0), 1 - Number.EPSILON);
    return patterns[Math.floor(clamped * patterns.length)];
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
                nearest = distance;
            } else if (distance < secondNearest) {
                secondNearest = distance;
            }
        }

        const crackDistance = secondNearest - nearest;

        const basePattern = this.patterns[0] ?? this.nodes[0];
        const crackPattern = this.patterns[1] ?? basePattern;

        return (crackDistance <= this.thickness ? crackPattern : basePattern).getPermutation(block, context);
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

        return getPatternFromValue(this.patterns, grain).getPermutation(block, context);
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

        return getPatternFromValue(this.patterns, bandValue).getPermutation(block, context);
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

        return getPatternFromValue(this.patterns, value).getPermutation(block, context);
    }

    toJSON() {
        return {
            type: "pingpong",
            settings: { size: this.size, strength: this.strength, octaves: this.octaves, persistence: this.persistence, lacunarity: this.lacunarity },
            children: [this.nodes[0].toJSON()],
        };
    }
}

export class ChainPatternNode extends PatternNode {
    readonly prec = 1;
    readonly opCount = 2;
    readonly variableOps = true;

    public evenDistribution = true;

    private weights: (number | undefined)[] = [];
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

export function patternsFromSelection(selection: Selection) {
    if (selection.isEmpty) return [];

    const [min, max] = selection.getRange();
    const dim = selection.player.dimension;
    const layers: { [layer: number]: Pattern } = {};
    const layerAxis = regionSize(min, max).largestAxis();

    for (const block of selection.getBlocks()) {
        const pattern = (layers[block[layerAxis]] ??= new Pattern());
        pattern.addBlock(dim.getBlock(block).permutation);
    }

    const patterns: Pattern[] = [];
    for (const layer in layers) {
        const pattern = layers[layer];
        pattern.optimize();
        patterns.push(pattern);
    }

    return patterns;
}
