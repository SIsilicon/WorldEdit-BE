import { BlockLocation, BlockPermutation, World } from 'mojang-minecraft';
import { dimension } from '../../library/@types';
import { Server } from '../../library/Minecraft.js';
import { printDebug, printLocation } from '../util.js';
import { Token } from './extern/tokenizr.js';
import { lexer, parseBlock, parsedBlock } from './parser.js';

// TODO: Update Documentation on patterns
export class Pattern {
    private blocks: parsedBlock[] = [];

    private constructor(blocks: parsedBlock[]) {
        this.blocks = blocks;
    }

    setBlock(loc: BlockLocation, dimension: dimension) {
        const block = this.blocks.length == 1 ? this.blocks[0] : this.blocks[Math.floor(Math.random() * this.blocks.length)];

        let command = block.id;
        if (block.states && block.states.size != 0) {
            command += '['
            let i = 0;
            for (const state of block.states.entries()) {
                command += `"${state[0]}":"${state[1]}"`
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

    static parseArg(argument: string) {
        const blocks: parsedBlock[] = [];
        
        let block: parsedBlock = null;
        function pushBlock() {
            if (block == null) {
                throw lexer.error('unexpected token!');
            }
            blocks.push(block);
            block = null;
        }

        lexer.input(argument);
        let token: Token;
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
        return new Pattern(blocks);
    }

    static parseBlockPermutations(blocks: BlockPermutation[]) {
        return new Pattern(
            blocks.map(v => {
                const states: Map<string, string> = new Map();
                v.getAllProperties().forEach(state => {
                    states.set(state.name, state.value);
                })
                return {
                    id: v.type.id,
                    data: -1,
                    states: states
                }
            })
        )
    }
}