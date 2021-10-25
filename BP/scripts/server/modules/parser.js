import { Tokenizr } from './extern/tokenizr.js';
export const lexer = new Tokenizr();
{
    lexer.rule(/'([a-z_][a-z0-9_]*)'/, (ctx, match) => {
        ctx.accept('string', match[1]);
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
export function parseBlock(lexer, idtoken) {
    const block = {
        id: idtoken.value,
        data: -1,
        states: null
    };
    let token;
    while (token = lexer.token()) {
        switch (token.type) {
            case 'colon':
                token = lexer.token();
                if (token.type == 'id') {
                    if (block.id.includes(':') || block.data != -1)
                        throw lexer.error('unexpected token!');
                    block.id += ':' + token.value;
                }
                else if (token.type == 'integer') {
                    if (block.data != -1)
                        throw lexer.error('unexpected token!');
                    block.data = token.value;
                }
                else {
                    throw lexer.error('unexpected token!');
                }
                break;
            case 'bracket':
                if (token.value == '[') {
                    if (block.states != null)
                        throw lexer.error('unexpected token!');
                    block.states = parseBlockStates(lexer);
                }
                else {
                    throw lexer.error('unexpected token!');
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
                throw lexer.error('unexpected token!');
        }
    }
}
function parseBlockStates(lexer) {
    let blockStates = new Map();
    let expectingBlockValue = false;
    let blockDataName = null;
    let blockDataValue = null;
    function pushDataTag() {
        blockStates.set(blockDataName, blockDataValue);
        expectingBlockValue = false;
        blockDataName = null;
        blockDataValue = null;
    }
    let token;
    while (token = lexer.token()) {
        switch (token.type) {
            case 'string':
                if (expectingBlockValue) {
                    if (blockDataValue != null)
                        throw lexer.error('unexpected token!');
                    blockDataValue = token.value;
                }
                else {
                    if (blockDataName != null)
                        throw lexer.error('unexpected token!');
                    blockDataName = token.value;
                }
                break;
            case 'colon':
                if (expectingBlockValue) {
                    throw lexer.error('unexpected token!');
                }
                expectingBlockValue = true;
                break;
            case 'comma':
                if (blockDataValue == null) {
                    throw lexer.error('unexpected token!');
                }
                pushDataTag();
                break;
            case 'bracket':
                if (token.value == '[' || token.value == ']' && blockDataValue == null) {
                    throw lexer.error('unexpected token!');
                }
                pushDataTag();
                return blockStates;
            default:
                throw lexer.error('unexpected token!');
        }
    }
}
