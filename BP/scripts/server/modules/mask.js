import { World } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { printLocation } from '../util.js';
import { lexer, parseBlock } from './parser.js';
// TODO: Implement 'not' and 'and' operations
export class Mask {
    constructor() {
        this.conditions = [];
        this.stringObj = '';
    }
    matchesBlock(loc, dimension) {
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
                    const prop = properties.find(value => {
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
            }
            else {
                let command = `testforblock ${printLocation(loc, false)} ${filter.id}`;
                if (filter.data != -1) {
                    command += ' ' + filter.data;
                }
                if (!Server.runCommand(command, dimension).error) {
                    passed = true;
                    break;
                }
                ;
            }
        }
        return passed;
    }
    ;
    clear() {
        this.conditions.length = 0;
        this.stringObj = '';
    }
    addBlock(block) {
        const states = new Map();
        block.getAllProperties().forEach(state => {
            states.set(state.name, state.value);
        });
        this.conditions.push({
            id: block.type.id,
            data: -1,
            states: states
        });
        this.stringObj = '(picked)';
    }
    getBlockSummary() {
        let text = '';
        for (const block of this.conditions) {
            let sub = block.id.replace('minecraft:', '');
            for (const state of block.states) {
                const val = state[1];
                if (typeof val == 'string' && val != 'x' && val != 'y' && val != 'z') {
                    sub += `(${val})`;
                    break;
                }
            }
            text += sub + ',';
        }
        return text.replace(/,\s*$/, '');
    }
    static parseArg(argument) {
        if (!argument) {
            return new Mask();
        }
        let conditions = [];
        let block = null;
        function pushBlock() {
            if (block == null) {
                throw lexer.error('expected block!');
            }
            conditions.push(block);
            block = null;
        }
        lexer.input(argument);
        let token;
        while (token = lexer.token()) {
            switch (token.type) {
                case 'id':
                    block = parseBlock(lexer, token);
                case 'comma':
                    pushBlock();
                    break;
                case 'EOF':
                    pushBlock();
                    break;
                default:
                    throw lexer.error('unexpected token!');
            }
        }
        const mask = new Mask();
        mask.stringObj = argument;
        mask.conditions = conditions;
        return mask;
    }
    toString() {
        return `[mask: ${this.stringObj}]`;
    }
}
