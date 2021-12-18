import { commandSyntaxError } from '@library/@types/build/classes/CommandBuilder';
import { Token, Tokenizr } from './extern/tokenizr.js';

export type parsedBlock = {
    id: string,
    data: number,
    states: Map<string, string|number|boolean>
}

export const lexer = new Tokenizr();
{
    lexer.rule(/'([a-z_][a-z0-9_]*)'/, (ctx, match) => {
        ctx.accept('string', match[1]);
    });
    lexer.rule(/(true|false)/, (ctx, match) => {
        ctx.accept('boolean', match[0] == 'true' ? true : false);
    });
    lexer.rule(/[a-z_][a-z0-9_]*/, (ctx, match) => {
        ctx.accept('id');
    });
    lexer.rule(/[0-9]+/, (ctx, match) => {
        ctx.accept('integer', parseInt(match[0]));
    });
    lexer.rule(/ +/, (ctx, match) => {
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
    lexer.rule(/[\[\]]/, (ctx, match) => {
        ctx.accept('bracket');
    });
}

export function throwTokenError(token: Token): never {
    const err: commandSyntaxError = {
        isSyntaxError: true,
        idx: -1,
        start: token.pos,
        end: token.pos + token.text.length
    };
    throw err;
}

export function parseBlock(lexer: Tokenizr, idtoken: Token) {
    const block: parsedBlock = {
        id: idtoken.value,
        data: -1,
        states: null
    }
    
    let token: Token;
    while (token = lexer.token()) {
        switch (token.type) {
                case 'colon':
                    token = lexer.token();
                    if (token.type == 'id') {
                        if (block.id.includes(':') || block.data != -1) throwTokenError(token);
                        block.id += ':' + token.value;
                    } else if (token.type == 'integer') {
                        if (block.data != -1) throwTokenError(token);
                        block.data = token.value;
                    } else {
                        throwTokenError(token);
                    }
                    break;
                case 'bracket':
                    if (token.value == '[') {
                        if (block.states != null) throwTokenError(token);
                        block.states = parseBlockStates(lexer);
                    } else {
                        throwTokenError(token);
                    }
                    break;
                case 'comma':
                case 'space':
                case 'EOF':
                    if (!block.id.includes(':')) {
                        block.id = 'minecraft:' + block.id;
                    }
                    return block;
                default:
                    throwTokenError(token);
        }    
    }
}

function parseBlockStates(lexer: Tokenizr) {
    let blockStates: Map<string, string> = new Map();
    let expectingBlockValue = false;
    let blockDataName: string = null;
    let blockDataValue: string = null;
    function pushDataTag() {
        blockStates.set(blockDataName, blockDataValue);
        expectingBlockValue = false;
        blockDataName = null;
        blockDataValue = null;
    }

    let token: Token;
    while (token = lexer.token()) {
        switch (token.type) {
                case 'string': case 'number': case 'boolean':
                    if (expectingBlockValue) {
                        if (blockDataValue != null)
                                throwTokenError(token);
                        blockDataValue = token.value;
                    } else {
                        if (blockDataName != null || token.type == 'number' || token.type == 'boolean')
                                throwTokenError(token);
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
                    if (token.value == '[' || token.value == ']' && blockDataValue == null) {
                        throwTokenError(token);
                    }
                    pushDataTag();
                    return blockStates;
                default:
                    throwTokenError(token);
        }
    }
}