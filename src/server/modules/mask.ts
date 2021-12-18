import { BlockLocation, BlockPermutation, BoolBlockProperty, IntBlockProperty, StringBlockProperty, World } from 'mojang-minecraft';
import { dimension } from '@library/@types/index.js';
import { commandSyntaxError } from '@library/@types/build/classes/CommandBuilder';
import { CustomArgType } from '@library/build/classes/commandBuilder.js';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation } from '../util.js';
import { Token, Tokenizr } from './extern/tokenizr.js';
import { lexer, throwTokenError, parseBlock, parsedBlock } from './parser.js';

// TODO: Implement 'not' and 'and' operations
export class Mask implements CustomArgType {
    private conditions: parsedBlock[] = [];
    private stringObj = '';

    constructor(mask: string = '') {
        if (mask) {
            const obj = Mask.parseArgs([mask]).result;
            this.conditions = obj.conditions;
            this.stringObj = obj.stringObj;
        }
    }

    matchesBlock(loc: BlockLocation, dimension: dimension) {
        if (this.conditions.length == 0) {
                return true;
        }

        const dim = World.getDimension(dimension);
        let passed = false;
        for (const filter of this.conditions) {
                if (filter.states) {
                    const block = dim.getBlock(loc).permutation;
                    if (block.type.id != filter.id) {
                        continue;
                    }
                    
                    const properties = block.getAllProperties();
                    let states_passed = 0;
                    for (const state of filter.states) {
                        const prop = <IntBlockProperty | BoolBlockProperty | StringBlockProperty> properties.find(value => {
                                return value.name == state[0];
                        });
                        if (prop && prop.value == state[1]) {
                                states_passed++;
                        }
                    }
                    if (states_passed == filter.states.size) {
                        passed = true;
                        break;
                    }
                } else {
                    let command = `testforblock ${printLocation(loc, false)} ${filter.id}`;
                    if (filter.data != -1) {
                        command += ' ' + filter.data;
                    }
                    if (!Server.runCommand(command, dimension).error) {
                        passed = true;
                        break;
                    };
                }
        }
        
        return passed;
    };

    clear() {
        this.conditions.length = 0;
        this.stringObj = '';
    }
    
    addBlock(block: BlockPermutation) {
        const states: Map<string, string|number|boolean> = new Map();
        block.getAllProperties().forEach(state => {
                states.set(state.name, state.value);
        })
        this.conditions.push({
                id: block.type.id,
                data: -1,
                states: states
        });
        this.stringObj = '(picked)';
    }
    
    getBlockSummary() {
        let text = '';
        let i = 0;
        for (const block of this.conditions) {
                let sub = block.id.replace('minecraft:', '');
                for (const state of block.states) {
                    const val = state[1];
                    if (typeof val == 'string' && val != 'x' && val != 'y' && val != 'z') {
                        sub += `(${val})`;
                        break;
                    }
                }
                text += sub;
                if (i < this.conditions.length-1) text += ', ';
                i++;
        }
        return text;
    }
    
    static parseArgs(args: Array<string>, index = 0) {
        if (!args[index]) {
            return {result: new Mask(), argIndex: index+1};
        }
        
        let conditions: parsedBlock[] = [];
        let block: parsedBlock = null;
        function pushBlock(token: Token) {
            if (block == null) {
                throwTokenError(token);
            }
            conditions.push(block);
            block = null;
        }
        
        lexer.input(args[index]);
        let token: Token;
        try {
            while (token = lexer.token()) {
                switch (token.type) {
                    case 'id':
                        block = parseBlock(lexer, token);
                    case 'comma':
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
        
        const mask = new Mask();
        mask.stringObj = args[index];
        mask.conditions = conditions;
        
        return {result: mask, argIndex: index+1};
    }
    
    static clone(original: Mask) {
        const mask = new Mask();
        mask.conditions = [...original.conditions];
        mask.stringObj = original.stringObj;
        return mask;
    }
    
    toString() {
        return `[mask: ${this.stringObj}]`;
    }
}