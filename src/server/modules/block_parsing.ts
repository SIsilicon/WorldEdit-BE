import { commandSyntaxError, contentLog, RawText, Server } from "@notbeer-api";
import { BlockPermutation, BlockStates, Dimension, Vector3 } from "@minecraft/server";
import { Token, Tokenizr, ParsingError } from "./extern/tokenizr.js";

export interface parsedBlock {
    id: string;
    states: Map<string, string | number | boolean>;
}

export interface BlockUnit {
    readonly typeId: string;
    readonly permutation: BlockPermutation;
    readonly location: Vector3;
    readonly dimension: Dimension;
    setPermutation(perm: BlockPermutation): void;
    hasTag(tag: string): boolean;
    isAir: boolean;
}

export interface AstNode {
    prec: number;
    opCount: number;
    rightAssoc?: boolean;
    nodes: AstNode[];
    token: Token;
}

const lexer = new Tokenizr();
{
    /*lexer.rule(/'(.*)'/, (ctx, match) => {
        ctx.accept('string', match[1]);
    });*/
    // eslint-disable-next-line no-useless-escape
    lexer.rule(/[~#%^=*+-/|:!&,@$\.]/, (ctx) => {
        ctx.accept("misc");
    });
    lexer.rule(/\s+/, (ctx) => {
        ctx.accept("space");
    });
    // eslint-disable-next-line no-useless-escape
    lexer.rule(/[\[\]\(\)\<\>\{\}]/, (ctx) => {
        ctx.accept("bracket");
    });
    lexer.rule(/(true|false)/, (ctx, match) => {
        ctx.accept("boolean", match[0] == "true" ? true : false);
    });
    lexer.rule(/[a-zA-Z_][a-zA-Z0-9_]*/, (ctx) => {
        ctx.accept("id");
    });
    lexer.rule(/[0-9]+(\.[0-9]+)*/, (ctx, match) => {
        ctx.accept("number", parseFloat(match[0]));
    });
    lexer.rule(/[0-9]+/, (ctx, match) => {
        ctx.accept("number", parseInt(match[0]));
    });
}

export function tokenize(input: string) {
    try {
        lexer.input(input);
    } catch (err) {
        if (err instanceof ParsingError) {
            const error: commandSyntaxError = {
                isSyntaxError: true,
                idx: -1,
                start: err.pos,
                end: err.pos + 1,
                stack: contentLog.stack(),
            };
            throw error;
        }
        throw err;
    }
    return new Tokens(lexer.tokens());
}

export function mergeTokens(start: Token, end: Token, input: string) {
    const sub = input.substring(start.pos, end.pos + end.text.length);
    return new Token("merge", sub, sub, start.pos);
}

export function throwTokenError(token: Token): never {
    const err: commandSyntaxError = {
        isSyntaxError: true,
        idx: -1,
        start: token.pos,
        end: token.pos + token.text.length,
        stack: contentLog.stack(),
    };
    throw err;
}

export function processOps(out: AstNode[], ops: AstNode[], op?: AstNode) {
    while (ops.length) {
        const op2 = ops.slice(-1)[0];
        if (op && (op.prec > op2.prec || (op.prec == op2.prec && op2.rightAssoc))) {
            break;
        }

        if (out.length < op2.opCount) {
            throwTokenError(op2.token);
        }

        ops.pop(); // <= op2
        for (let i = 0; i < op2.opCount; i++) {
            op2.nodes.unshift(out.pop());
        }
        out.push(op2);
    }

    if (op) {
        ops.push(op);
    }
}

export function blockPermutation2ParsedBlock(block: BlockPermutation) {
    const states: parsedBlock["states"] = new Map();
    Object.entries(block.getAllStates()).forEach(([state, value]) => {
        if (!state.startsWith("wall_connection_type") && !state.startsWith("liquid_depth")) {
            states.set(state, value);
        }
    });

    return {
        id: block.type.id,
        states,
    };
}

export function parsedBlock2BlockPermutation(block: parsedBlock) {
    return BlockPermutation.resolve(block.id, Object.fromEntries(block.states?.entries() ?? []));
}

export function parsedBlock2CommandArg(block: parsedBlock) {
    let id = block.id;
    if (id.startsWith("minecraft:")) id = id.slice("minecraft:".length);
    const states = block.states;
    if (states?.size) {
        id += `[${Array.from(states.entries())
            .map(([key, value]) => {
                value = typeof value === "string" ? `"${value}"` : value;
                return `"${key}"=${value}`;
            })
            .join(",")}]`;
    }
    return id;
}

export function parseBlock(tokens: Tokens, input: string, typeOnly: boolean, isMask = false): parsedBlock | string {
    let typeToken = tokens.curr();
    const block: parsedBlock = {
        id: tokens.curr().value,
        states: null,
    };
    let token: Token;

    function finish() {
        if (!block.id.includes(":")) {
            block.id = "minecraft:" + block.id;
        }

        let blockPerm: BlockPermutation;
        let blockProps: Record<string, string | number | boolean>;
        try {
            blockPerm = BlockPermutation.resolve(block.id);
            blockProps = blockPerm.getAllStates();
        } catch {
            throwTokenError(typeToken);
        }
        if (!isMask && blockPerm.getState("persistent_bit") != undefined && !block.states?.has("persistent_bit")) {
            if (!block.states) {
                block.states = new Map();
            }
            block.states.set("persistent_bit", true);
        }

        for (const [state, val] of block.states?.entries() ?? []) {
            if (!(state in blockProps)) {
                throw RawText.translate("commands.blockstate.stateError").with(state).with(block.id);
            } else if (typeof val != typeof blockProps[state]) {
                throw RawText.translate("commands.blockstate.typeError").with(state);
            } else if (!BlockStates.get(state).validValues.includes(val)) {
                throw RawText.translate("commands.blockstate.valueError").with(state);
            }
        }
        return typeOnly ? block.id : block;
    }

    // eslint-disable-next-line no-cond-assign
    while ((token = tokens.peek())) {
        switch (token.type) {
            case "misc":
                if (token.value == ":") {
                    token = tokens.next();
                    const peek = tokens.peek();
                    if (peek.type == "id") {
                        if (block.id.includes(":") || block.states) throwTokenError(peek);
                        block.id += ":" + peek.value;
                        token = tokens.next();
                        typeToken = mergeTokens(typeToken, token, input);
                        if (typeOnly) return finish();
                    } else if (peek.type == "number") {
                        if (typeOnly) return finish();
                        if (block.states) throwTokenError(peek);
                        block.states = new Map(Object.entries(Server.block.dataValueToStates(block.id, peek.value)));
                        token = tokens.next();
                        return finish();
                    } else {
                        throwTokenError(peek);
                    }
                } else {
                    return finish();
                }
                break;
            case "bracket":
                if (token.value == "[") {
                    if (typeOnly) return finish();
                    if (block.states != null) throwTokenError(token);
                    token = tokens.next();
                    block.states = parseBlockStates(tokens);
                    return finish();
                } else {
                    return finish();
                }
            default:
                return finish();
        }
    }
}

export function parseBlockStates(tokens: Tokens): parsedBlock["states"] {
    const blockStates: parsedBlock["states"] = new Map();
    let expectingBlockValue = false;
    let blockDataName: string = null;
    let blockDataValue: string | number | boolean = null;
    function pushDataTag() {
        blockStates.set(blockDataName, blockDataValue);
        expectingBlockValue = false;
        blockDataName = null;
        blockDataValue = null;
    }

    let token: Token;
    // eslint-disable-next-line no-cond-assign
    while ((token = tokens.next())) {
        switch (token.type) {
            case "id":
            case "number":
            case "boolean":
                if (expectingBlockValue) {
                    if (blockDataValue != null) {
                        throwTokenError(token);
                    }
                    blockDataValue = token.value;
                } else {
                    if (blockDataName != null || token.type == "number" || token.type == "boolean") {
                        throwTokenError(token);
                    }
                    blockDataName = token.value;
                }
                break;
            case "misc":
                if (token.value == ":") {
                    token = tokens.next();
                    if (token.type != "id" || blockDataName == null || blockDataName.includes(":") || expectingBlockValue) {
                        throwTokenError(token);
                    }
                    blockDataName += ":" + token.value;
                } else if (token.value == "=") {
                    if (expectingBlockValue) {
                        throwTokenError(token);
                    }
                    expectingBlockValue = true;
                } else if (token.value == ",") {
                    if (blockDataValue == null) {
                        throwTokenError(token);
                    }
                    pushDataTag();
                } else {
                    throwTokenError(token);
                }
                break;
            case "bracket":
                if (token.value != "]" || (token.value == "]" && blockDataValue == null)) {
                    throwTokenError(token);
                }
                pushDataTag();
                return blockStates;
            default:
                throwTokenError(token);
        }
    }
}

export function parseNumberList(tokens: Tokens, length: number): number[] {
    const array: number[] = [];
    let token: Token;
    let lastNumber: Token;
    // eslint-disable-next-line no-cond-assign
    while ((token = tokens.next())) {
        if (token.type == "number") {
            if (lastNumber) {
                throwTokenError(token);
            }
            lastNumber = token;
        } else if (token.value == ",") {
            if (!lastNumber || array.length == length - 1) {
                throwTokenError(token);
            }
            array.push(lastNumber.value);
            lastNumber = null;
        } else if (token.value == "]") {
            if (!lastNumber || array.length != length - 1) {
                throwTokenError(token);
            }
            array.push(lastNumber.value);
            break;
        } else {
            throwTokenError(token);
        }
    }
    return array;
}

class Tokens {
    private idx = -1;
    private currToken: Token;

    constructor(public readonly tokens: Token[]) {}

    curr() {
        return this.currToken;
    }

    next() {
        this.currToken = this.tokens[++this.idx];
        return this.currToken;
    }

    peek(pos = 0) {
        return this.tokens[this.idx + pos + 1];
    }

    seek(pos: number) {
        this.idx = pos - 1;
        return this.next();
    }

    getPos() {
        return this.idx;
    }
}
