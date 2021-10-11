import { World } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { printLocation } from '../util.js';
export class Pattern {
    constructor(blocks, arePermutations) {
        this.blocks = [];
        this.arePermutations = false;
        this.arePermutations = arePermutations;
        this.blocks = blocks;
    }
    setBlock(loc, dimension) {
        const block = this.blocks.length == 1 ? this.blocks[0] : this.blocks[Math.floor(Math.random() * this.blocks.length)];
        if (this.arePermutations) {
            World.getDimension(dimension).getBlock(loc).setPermutation(block.id);
            return false;
        }
        let command = block.id;
        if (block.states) {
            command += block.states;
        }
        else {
            command += ` ${block.data}`;
        }
        const result = Server.runCommand(`setblock ${printLocation(loc, false)} ${command}`, dimension);
        return result.error;
    }
    static parseArg(argument) {
        const blocks = [];
        for (const subArg of argument.split(',')) {
            const block = {
                id: '',
                data: 0,
                states: ''
            };
            let bracketIndex = -1;
            if ((bracketIndex = subArg.lastIndexOf('[')) != -1) {
                block.id = subArg.slice(0, bracketIndex);
                block.states = subArg.slice(bracketIndex);
                blocks.push(block);
                continue;
            }
            let colonIndex = -1;
            if ((colonIndex = subArg.lastIndexOf(':')) != -1) {
                const data = parseInt(subArg.slice(colonIndex + 1));
                if (isNaN(data)) {
                    block.id = subArg;
                }
                else {
                    block.id = subArg.slice(0, colonIndex);
                    block.data = data;
                }
                blocks.push(block);
                continue;
            }
            block.id = subArg;
            blocks.push(block);
        }
        return new Pattern(blocks, false);
    }
    static parseBlockPermutations(blocks) {
        return new Pattern(blocks.map(v => {
            return {
                id: v,
                data: 0,
                states: ''
            };
        }), true);
    }
}
