import { commandSyntaxError } from '@library/@types/build/classes/CommandBuilder';
import { Token, Tokenizr, ParsingError } from './extern/tokenizr.js';

export type parsedBlock = {
    id: string,
    data: number,
    states: Map<string, string|number|boolean>
}

export interface AstNode {
    prec: number,
    opCount: number,
    nodes: AstNode[],
    token: Token
}

const lexer = new Tokenizr();
{
    /*lexer.rule(/'(.*)'/, (ctx, match) => {
        ctx.accept('string', match[1]);
    });*/
    lexer.rule(/(true|false)/, (ctx, match) => {
        ctx.accept('boolean', match[0] == 'true' ? true : false);
    });
    lexer.rule(/[a-zA-Z_][a-zA-Z0-9_]*/, (ctx, match) => {
        ctx.accept('id');
    });
    lexer.rule(/[0-9]+/, (ctx, match) => {
        ctx.accept('number', parseInt(match[0]));
    });
    lexer.rule(/\s+/, (ctx, match) => {
        ctx.accept('space');
    });
    lexer.rule(/!/, (ctx, match) => {
        ctx.accept('exclamation');
    });
    lexer.rule(/:/, (ctx, match) => {
        ctx.accept('colon');
    });
    lexer.rule(/,/, (ctx, match) => {
        ctx.accept('comma');
    });
    lexer.rule(/[\[\]\(\)\<\>\{\}]/, (ctx, match) => {
        ctx.accept('bracket');
    });
    lexer.rule(/#/, (ctx, match) => {
        ctx.accept('hash');
    });
    lexer.rule(/%/, (ctx, match) => {
        ctx.accept('percent');
    });
    lexer.rule(/\^/, (ctx, match) => {
        ctx.accept('caret');
    });
    lexer.rule(/=/, (ctx, match) => {
        ctx.accept('equal');
    });
    lexer.rule(/\*/, (ctx, match) => {
        ctx.accept('star');
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
                stack: Error().stack
            };
            throw error;
        }
        throw err;
    }
    return new Tokens(lexer.tokens());
}

export function mergeTokens(start: Token, end: Token, input: string) {
    const sub = input.substring(start.pos, end.pos + end.text.length);
    return new Token('merge', sub, sub, start.pos);
}

export function throwTokenError(token: Token): never {
    const err: commandSyntaxError = {
        isSyntaxError: true,
        idx: -1,
        start: token.pos,
        end: token.pos + token.text.length,
        stack: Error().stack
    };
    throw err;
}

export function processOps(out: AstNode[], ops: AstNode[], op?: AstNode) {
    while (ops.length) {
        const op2 = ops.slice(-1)[0];
        if (op && op.prec > op2.prec) {
            break;
        }
        
        if (out.length < op2.opCount) {
            throwTokenError(op2.token);
        }
        
        ops.pop(); // <= op2
        for (let i = 0; i < op2.opCount; i++) {
            op2.nodes.push(out.pop());
        }
        out.push(op2);
    }
    
    if (op) {
        ops.push(op);
    }
}

export function parseBlock(tokens: Tokens): parsedBlock {
    const block: parsedBlock = {
        id: tokens.curr().value,
        data: -1,
        states: null
    }
    let token: Token;
    
    function finish() {
        if (!block.id.includes(':')) {
            block.id = 'minecraft:' + block.id;
        }
        return block;
    }
    
    while (token = tokens.peek()) {
        switch (token.type) {
            case 'colon':
                token = tokens.next();
                const peek = tokens.peek();
                if (peek.type == 'id') {
                    if (block.id.includes(':') || block.data != -1) throwTokenError(peek);
                    block.id += ':' + peek.value;
                    token = tokens.next();
                } else if (peek.type == 'number') {
                    if (block.data != -1)
                        throwTokenError(peek);
                    block.data = peek.value;
                    token = tokens.next();
                    return finish();
                } else {
                    throwTokenError(peek);
                }
                break;
            case 'bracket':
                if (token.value == '[') {
                    if (block.states != null)
                        throwTokenError(token);
                    token = tokens.next();
                    block.states = parseBlockStates(tokens);
                    return finish();
                } else {
                    return finish();
                }
                break;
            default:
                return finish();
        }    
    }
}

export function parseBlockStates(tokens: Tokens): parsedBlock['states'] {
    let blockStates: parsedBlock['states'] = new Map();
    let expectingBlockValue = false;
    let blockDataName: string = null;
    let blockDataValue: string|number|boolean = null;
    function pushDataTag() {
        blockStates.set(blockDataName, blockDataValue);
        expectingBlockValue = false;
        blockDataName = null;
        blockDataValue = null;
    }

    let token: Token;
    while (token = tokens.next()) {
        switch (token.type) {
            case 'id': case 'number': case 'boolean':
                if (expectingBlockValue) {
                    if (blockDataValue != null) {
                        throwTokenError(token);
                    }
                    blockDataValue = token.value;
                } else {
                    if (blockDataName != null || token.type == 'number' || token.type == 'boolean') {
                        throwTokenError(token);
                    }
                    blockDataName = token.value;
                }
                break;
            case 'colon':
                if (expectingBlockValue) {
                    throwTokenError(token);
                }
                expectingBlockValue = true;
                break;
            case 'comma':
                if (blockDataValue == null) {
                    throwTokenError(token);
                }
                pushDataTag();
                break;
            case 'bracket':
                if (token.value != ']' || token.value == ']' && blockDataValue == null) {
                    throwTokenError(token);
                }
                pushDataTag();
                return blockStates;
            default:
                throwTokenError(token);
        }
    }
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