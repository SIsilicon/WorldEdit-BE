import { Server } from '../../library/Minecraft.js';
import { printLocation } from '../util.js';
import { lexer, parseBlock } from './parser.js';
// TODO: Update Documentation on patterns
export class Pattern {
    constructor() {
        this.blocks = [];
        this.stringObj = '';
    }
    setBlock(loc, dimension) {
        const block = this.blocks.length == 1 ? this.blocks[0] : this.blocks[Math.floor(Math.random() * this.blocks.length)];
        let command = block.id;
        if (block.states && block.states.size != 0) {
            command += '[';
            let i = 0;
            for (const state of block.states.entries()) {
                command += `"${state[0]}":`;
                command += typeof state[1] == 'string' ? `"${state[1]}"` : `${state[1]}`;
                if (i < block.states.size - 1) {
                    command += ',';
                }
                i++;
            }
            command += ']';
        }
        else if (block.data != -1) {
            command += ` ${block.data}`;
        }
        const result = Server.runCommand(`setblock ${printLocation(loc, false)} ${command}`, dimension);
        return result.error;
    }
    clear() {
        this.blocks.length = 0;
        this.stringObj = '';
    }
    addBlock(block) {
        const states = new Map();
        block.getAllProperties().forEach(state => {
            states.set(state.name, state.value);
        });
        this.blocks.push({
            id: block.type.id,
            data: -1,
            states: states
        });
        this.stringObj = '(picked)';
    }
    getBlockSummary() {
        let text = '';
        let blockMap = new Map();
        for (const block of this.blocks) {
            let sub = block.id.replace('minecraft:', '');
            for (const state of block.states) {
                const val = state[1];
                if (typeof val == 'string' && val != 'x' && val != 'y' && val != 'z') {
                    sub += `(${val})`;
                    break;
                }
            }
            if (blockMap.has(sub)) {
                blockMap.set(sub, blockMap.get(sub) + 1);
            }
            else {
                blockMap.set(sub, 1);
            }
        }
        let i = 0;
        for (const block of blockMap) {
            if (block[1] > 1) {
                text += `${block[1]}x ${block[0]}`;
            }
            else {
                text += block[0];
            }
            if (i < blockMap.size - 1)
                text += ', ';
            i++;
        }
        return text;
    }
    static parseArg(argument) {
        if (!argument) {
            return new Pattern();
        }
        const blocks = [];
        let block = null;
        function pushBlock() {
            if (block == null) {
                throw lexer.error('unexpected token!');
            }
            blocks.push(block);
            block = null;
        }
        lexer.input(argument);
        let token;
        while (token = lexer.token()) {
            switch (token.type) {
                case 'id':
                    block = parseBlock(lexer, token);
                case ',':
                    pushBlock();
                    break;
                case 'EOF':
                    pushBlock();
                    break;
                default:
                    throw lexer.error('unexpected token!');
            }
        }
        const pattern = new Pattern();
        pattern.blocks = blocks;
        pattern.stringObj = argument;
        return pattern;
    }
    toString() {
        return `[pattern: ${this.stringObj}]`;
    }
}
