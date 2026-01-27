import { Vector3, BlockPermutation, BlockFilter, Direction } from "@minecraft/server";
import { CustomArgType, commandSyntaxError, Vector, whenReady } from "@notbeer-api";
import { Token } from "./extern/tokenizr.js";
import {
    tokenize,
    throwTokenError,
    mergeTokens,
    parseBlock,
    AstNode,
    processOps,
    parseBlockStates,
    parsedBlock,
    blockPermutation2ParsedBlock,
    BlockUnit,
    parsedBlock2BlockPermutation,
} from "./block_parsing.js";
import { iterateBlockPermutations } from "server/util.js";
import { PlayerSession } from "server/sessions.js";

interface maskContext {
    placePosition: Vector;
}

interface maskNodeJSON {
    type: string;
    settings?: any;
    children?: maskNodeJSON[];
}

export class Mask implements CustomArgType {
    private condition: MaskNode;
    private stringSource = undefined;
    private simpleCache: BlockFilter;

    private context = {} as maskContext;

    constructor(mask: string | maskNodeJSON = "") {
        if (!mask) return;
        whenReady(() => {
            const obj = typeof mask === "string" ? Mask.parseArgs([mask]).result : Mask.parseJSON(mask);
            this.condition = obj.condition;
            this.stringSource = obj.stringSource;
        });
    }

    withContext(session: PlayerSession) {
        const mask = this.clone();
        mask.context.placePosition = session.getPlacementPosition().add(0.5);
        mask.getRootNode()?.prepare();
        return mask;
    }

    /**
     * Tests if this mask matches a block
     * @param block
     * @returns True if the block matches; false otherwise
     */
    matchesBlock(block: BlockUnit) {
        if (this.empty()) return true;
        return this.condition.matchesBlock(block, this.context);
    }

    getRootNode() {
        return this.condition;
    }

    clear() {
        this.condition = undefined;
        this.stringSource = this.stringSource ? "" : undefined;
        this.simpleCache = undefined;
    }

    empty() {
        return !this.condition;
    }

    addBlock(permutation: BlockPermutation) {
        if (this.condition == null) {
            this.condition = new ChainMaskNode(undefined);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.condition.nodes.push(new BlockMaskNode(undefined, block));

        if (this.stringSource) {
            this.stringSource += ",";
            this.stringSource += block.id.replace("minecraft:", "");
            if (block.states.size) this.stringSource += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;
        }
        this.simpleCache = undefined;
    }

    intersect(mask: Mask) {
        let node: MaskNode;
        if (!mask.condition) {
            node = this.condition;
        } else if (!this.condition) {
            node = mask.condition;
        } else {
            node = new IntersectMaskNode(null);
            node.nodes = [this.condition, mask.condition];
        }

        const intersect = new Mask();
        intersect.condition = node;
        return intersect;
    }

    isSimple() {
        const root = this.condition;
        const child = root?.nodes[0];
        return (
            !root ||
            root instanceof BlockMaskNode ||
            (root instanceof ChainMaskNode && root.nodes.every((node) => node instanceof BlockMaskNode)) ||
            (root instanceof NegateMaskNode && (child instanceof BlockMaskNode || (child instanceof ChainMaskNode && child.nodes.every((node) => node instanceof BlockMaskNode))))
        );
    }

    getSimpleBlockFilter() {
        if (this.simpleCache) return this.simpleCache;

        const addToFilter = (block: parsedBlock, types: string[], perms: BlockPermutation[]) => {
            const perm = parsedBlock2BlockPermutation(block);
            if (block.states != null) {
                const test = Array.from(block.states.entries());
                for (const states of iterateBlockPermutations(block.id)) {
                    if (!test.every(([key, value]) => states[key] === value)) continue;
                    perms.push(BlockPermutation.resolve(block.id, states));
                }
            } else {
                types.push(perm.type.id);
            }
        };

        const includeTypes: string[] = [];
        const excludeTypes: string[] = [];
        const includePerms: BlockPermutation[] = [];
        const excludePerms: BlockPermutation[] = [];
        this.simpleCache = {};

        if (this.condition instanceof BlockMaskNode) addToFilter(this.condition.block, includeTypes, includePerms);
        else if (this.condition instanceof ChainMaskNode) this.condition.nodes.forEach((node) => addToFilter((<BlockMaskNode>node).block, includeTypes, includePerms));
        else if (this.condition instanceof NegateMaskNode) {
            const negated = this.condition.nodes[0];
            if (negated instanceof BlockMaskNode) addToFilter(negated.block, excludeTypes, excludePerms);
            else if (negated instanceof ChainMaskNode) negated.nodes.forEach((node) => addToFilter((<BlockMaskNode>node).block, excludeTypes, excludePerms));
        }

        if (includeTypes.length) this.simpleCache.includeTypes = includeTypes;
        if (excludeTypes.length) this.simpleCache.excludeTypes = excludeTypes;
        if (includePerms.length) this.simpleCache.includePermutations = includePerms;
        if (excludePerms.length) this.simpleCache.excludePermutations = excludePerms;

        return this.simpleCache;
    }

    clone() {
        const mask = new Mask();
        mask.condition = this.condition;
        mask.stringSource = this.stringSource;
        return mask;
    }

    convertToJSON() {
        this.stringSource = undefined;
    }

    toJSON() {
        return this.stringSource ?? this.condition?.toJSON() ?? "";
    }

    toString() {
        return `[mask: ${this.stringSource ?? JSON.stringify(this.condition)}]`;
    }

    static parseArgs(args: Array<string>, index = 0) {
        const input = args[index];
        if (!input) return { result: new Mask(), argIndex: index + 1 };

        const tokens = tokenize(input);
        let token: Token;

        function processTokens(inBracket: boolean) {
            const ops: MaskNode[] = [];
            const out: MaskNode[] = [];
            const start = tokens.curr();

            function nodeToken() {
                return mergeTokens(token, tokens.curr(), input);
            }

            // eslint-disable-next-line no-cond-assign
            while ((token = tokens.next())) {
                if (token.type == "id") {
                    out.push(new BlockMaskNode(nodeToken(), parseBlock(tokens, input, false, true) as parsedBlock));
                } else if (token.value == ",") {
                    processOps(out, ops, new ChainMaskNode(token));
                } else if (token.type == "space") {
                    processOps(out, ops, new IntersectMaskNode(token));
                } else if (token.value == "!") {
                    processOps(out, ops, new NegateMaskNode(token));
                } else if (token.type == "bracket") {
                    if (token.value == "<") {
                        processOps(out, ops, new OffsetMaskNode(token, Vector.UP));
                    } else if (token.value == ">") {
                        processOps(out, ops, new OffsetMaskNode(token, Vector.DOWN));
                    } else if (token.value == "(") {
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
                } else if (token.value == "#") {
                    const t = tokens.next();
                    if (t.value == "existing") {
                        out.push(new ExistingMaskNode(nodeToken()));
                    } else if (t.value == "surface" || t.value == "exposed") {
                        let lowerAngle: number | undefined;
                        let upperAngle: number | undefined;
                        if (tokens.peek().value == "[") {
                            tokens.next();
                            let t = tokens.next();
                            if (t.type != "number") throwTokenError(t);
                            lowerAngle = <number>t.value;
                            t = tokens.next();
                            if (t.value != ":") throwTokenError(t);
                            t = tokens.next();
                            if (t.type != "number") throwTokenError(t);
                            upperAngle = <number>t.value;
                            t = tokens.next();
                            if (t.value != "]") throwTokenError(t);
                        }
                        out.push(new SurfaceMaskNode(nodeToken(), lowerAngle, upperAngle));
                    } else if (t.value == "shadow") {
                        out.push(new ShadowMaskNode(nodeToken()));
                    } else if (t.value == "#") {
                        const id = tokens.next();
                        if (id.type != "id") {
                            throwTokenError(id);
                        }
                        out.push(new TagMaskNode(nodeToken(), id.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == "%") {
                    const num = tokens.next();
                    if (num.type != "number") {
                        throwTokenError(num);
                    }
                    out.push(new PercentMaskNode(nodeToken(), num.value / 100));
                } else if (token.value == "^") {
                    let states: parsedBlock["states"];
                    let strict = false;
                    let t = tokens.next();
                    if (t.value == "=") {
                        strict = true;
                        t = tokens.next();
                        if (t.value != "[") {
                            throwTokenError(t);
                        }
                        states = parseBlockStates(tokens);
                    } else if (t.value == "[") {
                        states = parseBlockStates(tokens);
                    } else {
                        throwTokenError(t);
                    }
                    out.push(new StateMaskNode(nodeToken(), states, strict));
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

        let out: MaskNode;
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

        const mask = new Mask();
        mask.stringSource = args[index];
        mask.condition = out;

        return { result: mask, argIndex: index + 1 };
    }

    static parseJSON(json: maskNodeJSON): Mask {
        function buildNode({ type, settings, children }: maskNodeJSON): MaskNode {
            let node!: MaskNode;
            switch (type) {
                case "block": {
                    const block: parsedBlock = { id: settings.id, states: settings.states ? new Map(Object.entries(settings.states)) : null };
                    node = new BlockMaskNode(null, block);
                    break;
                }
                case "state":
                    node = new StateMaskNode(null, settings.states ? new Map(Object.entries(settings.states)) : new Map(), settings.strict);
                    break;
                case "percent":
                    node = new PercentMaskNode(null, settings.percent);
                    break;
                case "existing":
                    node = new ExistingMaskNode(null);
                    break;
                case "surface":
                    node = new SurfaceMaskNode(null, settings?.lowerAngle, settings?.upperAngle);
                    break;
                case "shadow":
                    node = new ShadowMaskNode(null);
                    break;
                case "tag":
                    node = new TagMaskNode(null, settings.tag);
                    break;
                case "input":
                    node = new InputMaskNode(null, settings.input);
                    break;
                case "chain":
                    node = new ChainMaskNode(null);
                    break;
                case "intersect":
                    node = new IntersectMaskNode(null);
                    break;
                case "negate":
                    node = new NegateMaskNode(null);
                    break;
                case "offset":
                    node = new OffsetMaskNode(null, Vector.from(settings.offset));
                    break;
                default:
                    throw new Error(`Unknown mask type: ${type}`);
            }

            if (children) node.nodes = children.map((c) => buildNode(c));
            return node;
        }

        const mask = new Mask();
        mask.condition = buildNode(json);
        mask.condition.optimize();
        return mask;
    }

    static fromNode(node: MaskNode) {
        const mask = new Mask();
        mask.condition = node;
        return mask;
    }
}

export abstract class MaskNode implements AstNode {
    public nodes: MaskNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    prepare() {
        for (const node of this.nodes) node.prepare();
    }

    abstract matchesBlock(block: BlockUnit, context: maskContext): boolean;

    optimize() {
        for (const node of this.nodes) node.optimize();
    }

    abstract toJSON(): maskNodeJSON;
}

export class BlockMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    states: Record<string, string | number | boolean>;

    constructor(
        token: Token,
        public block: parsedBlock
    ) {
        super(token);
    }

    prepare() {
        super.prepare();
        this.states = Object.fromEntries(this.block.states?.entries() ?? []);
    }

    matchesBlock(block: BlockUnit) {
        return block.permutation.matches(this.block.id, this.states);
    }

    toJSON() {
        return { type: "block", settings: { id: this.block.id, states: Object.fromEntries(this.block.states?.entries() ?? []) } };
    }
}

export class StateMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public states: parsedBlock["states"],
        public strict: boolean
    ) {
        super(token);
    }

    matchesBlock(block: BlockUnit) {
        const props = block.permutation.getAllStates();
        let statesPassed = 0;
        for (const [state, val] of this.states.entries()) {
            if (this.strict && state in props && val === props[state]) statesPassed++;
            else if (!this.strict && (!(state in props) || val === props[state])) statesPassed++;
        }
        return statesPassed === this.states.size;
    }

    toJSON() {
        return { type: "state", settings: { states: Object.fromEntries(this.states ?? []), strict: this.strict } };
    }
}

export class SurfaceMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    static readonly testDistance = 2;
    static readonly testOffsets = {
        "-z": Vector.from(Direction.North).mul(SurfaceMaskNode.testDistance),
        "+z": Vector.from(Direction.South).mul(SurfaceMaskNode.testDistance),
        "+x": Vector.from(Direction.East).mul(SurfaceMaskNode.testDistance),
        "-x": Vector.from(Direction.West).mul(SurfaceMaskNode.testDistance),
    };

    constructor(
        token: Token,
        public lowerAngle?: number,
        public upperAngle?: number
    ) {
        super(token);
    }

    matchesBlock(block: BlockUnit) {
        const loc = Vector.from(block.location);
        const dim = block.dimension;
        const isEmpty = (loc: Vector3) => {
            return dim.getBlock(loc).isAir;
        };

        const isSurface =
            !isEmpty(loc) &&
            (isEmpty(loc.offset(0, 1, 0)) ||
                isEmpty(loc.offset(0, -1, 0)) ||
                isEmpty(loc.offset(-1, 0, 0)) ||
                isEmpty(loc.offset(1, 0, 0)) ||
                isEmpty(loc.offset(0, 0, -1)) ||
                isEmpty(loc.offset(0, 0, 1)));

        if (!isSurface) return false;
        if (this.lowerAngle === undefined || this.upperAngle === undefined) return true;

        const heights: { [dir: string]: number } = {};

        for (const [entry, offset] of Object.entries(SurfaceMaskNode.testOffsets)) {
            const start = Vector.add(block, offset).add(0.5);

            let testBlock = block.dimension.getBlock(start);
            while (testBlock?.isSolid) {
                testBlock = testBlock.above();
                start.y++;
            }

            const hit = block.dimension.getBlockFromRay(start, Vector.DOWN, { includePassableBlocks: false, includeLiquidBlocks: false });
            if (hit) heights[entry] = hit.block.y + hit.faceLocation.y;
        }

        const distance2 = SurfaceMaskNode.testDistance * 2;
        const slopeX = Math.abs(heights["+z"] - heights["-z"]) / distance2;
        const slopeZ = Math.abs(heights["+x"] - heights["-x"]) / distance2;
        const pitch = 90 - Math.atan(1 / Math.sqrt(slopeX ** 2 + slopeZ ** 2)) * (180 / Math.PI);
        return pitch >= this.lowerAngle && pitch <= this.upperAngle;
    }

    toJSON() {
        return { type: "surface", settings: { lowerAngle: this.lowerAngle, upperAngle: this.upperAngle } };
    }
}

export class ExistingMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    matchesBlock(block: BlockUnit) {
        return !block.isAir;
    }

    toJSON() {
        return { type: "existing" };
    }
}

export class ShadowMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    static readonly testFaces = [
        Vector.from(Direction.Up).mul(0.5),
        Vector.from(Direction.Down).mul(0.5),
        Vector.from(Direction.North).mul(0.5),
        Vector.from(Direction.South).mul(0.5),
        Vector.from(Direction.East).mul(0.5),
        Vector.from(Direction.West).mul(0.5),
    ];

    matchesBlock(block: BlockUnit, context: maskContext) {
        const start = context.placePosition;
        const toBlock = Vector.sub(Vector.add(block.location, [0.5, 0.5, 0.5]), start);
        for (const face of ShadowMaskNode.testFaces) {
            if (face.dot(toBlock) > 0) continue;
            const target = Vector.add(block.location, face).add(0.5);
            const ray = Vector.sub(target, start);
            const hit = block.dimension.getBlockFromRay(start, ray, { includePassableBlocks: false, includeLiquidBlocks: false });
            if (!hit) return false;

            const hitLocation = Vector.add(hit.block, hit.faceLocation);
            if (Vector.sub(hitLocation, start).length > ray.length + 0.01 || Vector.equals(hit.block, block.location)) return false;
        }
        return true;
    }

    toJSON() {
        return { type: "shadow" };
    }
}

export class TagMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public tag: string
    ) {
        super(token);
    }

    matchesBlock(block: BlockUnit) {
        return block.hasTag(this.tag);
    }

    toJSON() {
        return { type: "tag", settings: { tag: this.tag } };
    }
}

export class InputMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    private node: MaskNode;

    constructor(
        token: Token,
        public input: string
    ) {
        super(token);
    }

    prepare() {
        super.prepare();
        this.node = new Mask(this.input).getRootNode();
    }

    matchesBlock(block: BlockUnit, context: maskContext) {
        return this.node.matchesBlock(block, context);
    }

    toJSON() {
        return { type: "input", settings: { input: this.input } };
    }
}

export class PercentMaskNode extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    constructor(
        token: Token,
        public percent: number
    ) {
        super(token);
    }

    matchesBlock() {
        return Math.random() < this.percent;
    }

    toJSON() {
        return { type: "percent", settings: { percent: this.percent } };
    }
}

export class ChainMaskNode extends MaskNode {
    readonly prec = 3;
    readonly opCount = 2;
    readonly variableOps = true;

    constructor(token: Token, nodes: MaskNode[] = []) {
        super(token);
        this.nodes = [...nodes];
    }

    matchesBlock(block: BlockUnit, context: maskContext) {
        return this.nodes.some((mask) => mask.matchesBlock(block, context));
    }

    toJSON() {
        return { type: "chain", children: this.nodes.map((node) => node.toJSON()) };
    }
}

export class IntersectMaskNode extends MaskNode {
    readonly prec = 1;
    readonly opCount = 2;
    readonly variableOps = true;

    constructor(token: Token, nodes: MaskNode[] = []) {
        super(token);
        this.nodes = [...nodes];
    }

    matchesBlock(block: BlockUnit, context: maskContext) {
        return this.nodes.every((mask) => mask.matchesBlock(block, context));
    }

    toJSON() {
        return { type: "intersect", children: this.nodes.map((node) => node.toJSON()) };
    }
}

export class NegateMaskNode extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;

    constructor(token: Token, node?: MaskNode) {
        super(token);
        if (node) this.nodes.push(node);
    }

    matchesBlock(block: BlockUnit, context: maskContext) {
        return !this.nodes[0].matchesBlock(block, context);
    }

    toJSON() {
        return { type: "negate", children: [this.nodes[0].toJSON()] };
    }
}

// Overlay and Underlay
export class OffsetMaskNode extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;

    private x: number;
    private y: number;
    private z: number;

    constructor(
        token: Token,
        public offset: Vector3,
        node?: MaskNode
    ) {
        super(token);
        if (node) this.nodes.push(node);
    }

    prepare() {
        this.x = this.offset.x;
        this.y = this.offset.y;
        this.z = this.offset.z;
    }

    matchesBlock(block: BlockUnit, context: maskContext) {
        const loc = block.location;
        return this.nodes[0].matchesBlock(
            block.dimension.getBlock({
                x: loc.x + this.x,
                y: loc.y + this.y,
                z: loc.z + this.z,
            }),
            context
        );
    }

    optimize() {
        super.optimize();
        while (this.nodes[0] instanceof OffsetMaskNode) {
            this.x += this.nodes[0].x;
            this.y += this.nodes[0].y;
            this.z += this.nodes[0].z;
            this.nodes = this.nodes[0].nodes;
        }
    }

    toJSON() {
        return { type: "offset", settings: { offset: [this.offset.x, this.offset.y, this.offset.z] }, children: [this.nodes[0].toJSON()] };
    }
}
