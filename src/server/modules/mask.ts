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

export class Mask implements CustomArgType {
    private condition: MaskNode;
    private stringObj = "";
    private simpleCache: BlockFilter;

    private context = {} as maskContext;

    constructor(mask = "") {
        if (!mask) return;
        whenReady(() => {
            const obj = Mask.parseArgs([mask]).result;
            this.condition = obj.condition;
            this.stringObj = obj.stringObj;
        });
    }

    withContext(session: PlayerSession) {
        const mask = this.clone();
        mask.context.placePosition = session.getPlacementPosition().add(0.5);
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

    clear() {
        this.condition = null;
        this.stringObj = "";
        this.simpleCache = undefined;
    }

    empty() {
        return this.condition == null;
    }

    addBlock(permutation: BlockPermutation) {
        if (this.condition == null) {
            this.condition = new ChainMask(null);
        }

        const block = blockPermutation2ParsedBlock(permutation);
        this.condition.nodes.push(new BlockMask(null, block));

        if (this.stringObj) this.stringObj += ",";
        this.stringObj += block.id.replace("minecraft:", "");
        if (block.states.size) this.stringObj += `[${[...block.states].map(([key, value]) => `${key}=${value}`).join(",")}]`;

        this.simpleCache = undefined;
    }

    intersect(mask: Mask) {
        let node: MaskNode;
        if (!mask.condition) {
            node = this.condition;
        } else if (!this.condition) {
            node = mask.condition;
        } else {
            node = new IntersectMask(null);
            node.nodes = [this.condition, mask.condition];
        }

        const intersect = new Mask();
        intersect.condition = node;
        return intersect;
    }

    getBlockSummary() {
        if (!this.condition || !(this.condition instanceof ChainMask)) {
            return "";
        }

        let text = "";
        let i = 0;
        for (const mask of this.condition.nodes) {
            let sub = (<BlockMask>mask).block.id.replace("minecraft:", "");
            for (const state of (<BlockMask>mask).block.states) {
                const val = state[1];
                if (typeof val == "string" && val != "x" && val != "y" && val != "z") {
                    sub += `(${val})`;
                    break;
                }
            }
            text += sub;
            if (i < this.condition.nodes.length - 1) text += ", ";
            i++;
        }
        return text;
    }

    toJSON() {
        return this.stringObj;
    }

    isSimple() {
        const root = this.condition;
        const child = root?.nodes[0];
        return (
            !root ||
            root instanceof BlockMask ||
            (root instanceof ChainMask && root.nodes.every((node) => node instanceof BlockMask)) ||
            (root instanceof NegateMask && (child instanceof BlockMask || (child instanceof ChainMask && child.nodes.every((node) => node instanceof BlockMask))))
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

        if (this.condition instanceof BlockMask) addToFilter(this.condition.block, includeTypes, includePerms);
        else if (this.condition instanceof ChainMask) this.condition.nodes.forEach((node) => addToFilter((<BlockMask>node).block, includeTypes, includePerms));
        else if (this.condition instanceof NegateMask) {
            const negated = this.condition.nodes[0];
            if (negated instanceof BlockMask) addToFilter(negated.block, excludeTypes, excludePerms);
            else if (negated instanceof ChainMask) negated.nodes.forEach((node) => addToFilter((<BlockMask>node).block, excludeTypes, excludePerms));
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
        mask.stringObj = this.stringObj;
        return mask;
    }

    toString() {
        return `[mask: ${this.stringObj}]`;
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
                    out.push(new BlockMask(nodeToken(), parseBlock(tokens, input, false, true) as parsedBlock));
                } else if (token.value == ",") {
                    processOps(out, ops, new ChainMask(token));
                } else if (token.type == "space") {
                    processOps(out, ops, new IntersectMask(token));
                } else if (token.value == "!") {
                    processOps(out, ops, new NegateMask(token));
                } else if (token.type == "bracket") {
                    if (token.value == "<") {
                        processOps(out, ops, new OffsetMask(token, 0, 1, 0));
                    } else if (token.value == ">") {
                        processOps(out, ops, new OffsetMask(token, 0, -1, 0));
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
                        out.push(new ExistingMask(nodeToken()));
                    } else if (t.value == "surface" || t.value == "exposed") {
                        out.push(new SurfaceMask(nodeToken()));
                    } else if (t.value == "shadow") {
                        out.push(new ShadowMask(nodeToken()));
                    } else if (t.value == "#") {
                        const id = tokens.next();
                        if (id.type != "id") {
                            throwTokenError(id);
                        }
                        out.push(new TagMask(nodeToken(), id.value));
                    } else {
                        throwTokenError(t);
                    }
                } else if (token.value == "%") {
                    const num = tokens.next();
                    if (num.type != "number") {
                        throwTokenError(num);
                    }
                    out.push(new PercentMask(nodeToken(), num.value / 100));
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
                    out.push(new StateMask(nodeToken(), states, strict));
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

        const mask = new Mask();
        mask.stringObj = args[index];
        mask.condition = out;

        return { result: mask, argIndex: index + 1 };
    }
}

abstract class MaskNode implements AstNode {
    public nodes: MaskNode[] = [];
    abstract readonly prec: number;
    abstract readonly opCount: number;

    constructor(public readonly token: Token) {}

    abstract matchesBlock(block: BlockUnit, context: maskContext): boolean;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    postProcess() {}
}

class BlockMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;
    readonly states: Record<string, string | number | boolean>;

    constructor(
        token: Token,
        public block: parsedBlock
    ) {
        super(token);
        this.states = Object.fromEntries(block.states?.entries() ?? []);
    }

    matchesBlock(block: BlockUnit) {
        return block.permutation.matches(this.block.id, this.states);
    }
}

class StateMask extends MaskNode {
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
        let states_passed = 0;
        for (const [state, val] of this.states.entries()) {
            if (this.strict && state in props && val == props[state]) {
                states_passed++;
            } else if (!this.strict && (!(state in props) || val == props[state])) {
                states_passed++;
            }
        }
        return states_passed == this.states.size;
    }
}

class SurfaceMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    matchesBlock(block: BlockUnit) {
        const loc = Vector.from(block.location);
        const dim = block.dimension;
        const isEmpty = (loc: Vector3) => {
            return dim.getBlock(loc).isAir;
        };

        return (
            !isEmpty(loc) &&
            (isEmpty(loc.offset(0, 1, 0)) ||
                isEmpty(loc.offset(0, -1, 0)) ||
                isEmpty(loc.offset(-1, 0, 0)) ||
                isEmpty(loc.offset(1, 0, 0)) ||
                isEmpty(loc.offset(0, 0, -1)) ||
                isEmpty(loc.offset(0, 0, 1)))
        );
    }
}

class ExistingMask extends MaskNode {
    readonly prec = -1;
    readonly opCount = 0;

    matchesBlock(block: BlockUnit) {
        return !block.isAir;
    }
}

class ShadowMask extends MaskNode {
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
        for (const face of ShadowMask.testFaces) {
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
}

class TagMask extends MaskNode {
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
}

class PercentMask extends MaskNode {
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
}

class ChainMask extends MaskNode {
    readonly prec = 3;
    readonly opCount = 2;

    matchesBlock(block: BlockUnit, context: maskContext) {
        for (const mask of this.nodes) {
            if (mask.matchesBlock(block, context)) return true;
        }
        return false;
    }

    postProcess() {
        super.postProcess();

        const masks = this.nodes;
        this.nodes = [];
        while (masks.length) {
            const mask = masks.shift();
            if (mask instanceof ChainMask) {
                const sub = mask.nodes.reverse();
                for (const child of sub) {
                    masks.unshift(child);
                }
            } else {
                this.nodes.push(mask);
                mask.postProcess();
            }
        }
    }
}

class IntersectMask extends MaskNode {
    readonly prec = 1;
    readonly opCount = 2;

    matchesBlock(block: BlockUnit, context: maskContext) {
        for (const mask of this.nodes) {
            if (!mask.matchesBlock(block, context)) return false;
        }
        return true;
    }

    postProcess() {
        super.postProcess();

        const masks = this.nodes;
        this.nodes = [];
        while (masks.length) {
            const mask = masks.shift();
            if (mask instanceof IntersectMask) {
                const sub = mask.nodes.reverse();
                for (const child of sub) {
                    masks.unshift(child);
                }
            } else {
                this.nodes.push(mask);
                mask.postProcess();
            }
        }
    }
}

class NegateMask extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;

    matchesBlock(block: BlockUnit, context: maskContext) {
        return !this.nodes[0].matchesBlock(block, context);
    }
}

// Overlay and Underlay
class OffsetMask extends MaskNode {
    readonly prec = 2;
    readonly opCount = 1;

    constructor(
        token: Token,
        public x: number,
        public y: number,
        public z: number
    ) {
        super(token);
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

    postProcess() {
        while (this.nodes[0] instanceof OffsetMask) {
            this.x += this.nodes[0].x;
            this.y += this.nodes[0].y;
            this.z += this.nodes[0].z;
            this.nodes = this.nodes[0].nodes;
        }
    }
}
