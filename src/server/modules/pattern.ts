import { BlockLocation, BlockPermutation, World } from 'mojang-minecraft';
import { dimension } from '@library/@types';
import { commandSyntaxError } from '@library/@types/build/classes/CommandBuilder';
import { CustomArgType } from '@library/build/classes/commandBuilder.js';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation } from '../util.js';
import { Token } from './extern/tokenizr.js';
import { lexer, throwTokenError, parseBlock, parsedBlock } from './parser.js';

// TODO: Update Documentation on patterns
export class Pattern {
    private blocks: parsedBlock[] = [];
    private stringObj = '';
    
    constructor(pattern: string = '') {
        if (pattern) {
            const obj = Pattern.parseArgs([pattern]).result;
            this.blocks = obj.blocks;
            this.stringObj = obj.stringObj;
        }
    }
    
    setBlock(loc: BlockLocation, dimension: dimension) {
        const block = this.blocks.length == 1 ? this.blocks[0] : this.blocks[Math.floor(Math.random() * this.blocks.length)];
    
        let command = block.id;
        if (block.states && block.states.size != 0) {
                command += '['
                let i = 0;
                for (const state of block.states.entries()) {
                    command += `"${state[0]}":`;
                    command += typeof state[1] == 'string' ? `"${state[1]}"` : `${state[1]}`;
                    if (i < block.states.size - 1) {
                        command += ',';
                    }
                    i++;
                }
                command += ']'
        } else if (block.data != -1) {
                command += ` ${block.data}`;
        }
        const result = Server.runCommand(`setblock ${printLocation(loc, false)} ${command}`, dimension);
        return result.error;
    }
    
    clear() {
        this.blocks.length = 0;
        this.stringObj = '';
    }
    
    addBlock(block: BlockPermutation) {
        const states: Map<string, string|number|boolean> = new Map();
        block.getAllProperties().forEach(state => {
                states.set(state.name, state.value);
        })
        this.blocks.push({
                id: block.type.id,
                data: -1,
                states: states
        });
        this.stringObj = '(picked)';
    }
    
    getBlockSummary() {
        let text = '';
        let blockMap = new Map<string, number>();
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
                if (i < blockMap.size-1) text += ', ';
                i++;
        }
        return text;
    }
    
    static parseArgs(args: Array<string>, index = 0) {
        if (!args[index]) {
            return {result: new Pattern(), argIndex: index+1};
        }
        
        const blocks: parsedBlock[] = [];
        let block: parsedBlock = null;
        function pushBlock(token: Token) {
            if (block == null) {
                throwTokenError(token);
            }
            blocks.push(block);
            block = null;
        }

        lexer.input(args[index]);
        let token: Token;
        try {
            while (token = lexer.token()) {
                switch (token.type) {
                    case 'id':
                        block = parseBlock(lexer, token);
                    case ',':
                        pushBlock(token);
                        break;
                    case 'EOF':
                        pushBlock(token);
                        break;
                    default:
                        throwTokenError(token);
                }
            }
        } catch (error) {
            if (error.pos != undefined) {
                const err: commandSyntaxError = {
                    isSyntaxError: true,
                    idx: index,
                    start: error.pos,
                    end: error.pos+1
                };
                throw err;
            }
            throw error;
        }
        const pattern = new Pattern();
        pattern.blocks = blocks;
        pattern.stringObj = args[index];
        return {result: pattern, argIndex: index+1};
    }
    
    static clone(original: Pattern) {
        const pattern = new Pattern();
        pattern.blocks = [...original.blocks];
        pattern.stringObj = original.stringObj;
        return pattern;
    }
    
    toString() {
        return `[pattern: ${this.stringObj}]`;
    }
}