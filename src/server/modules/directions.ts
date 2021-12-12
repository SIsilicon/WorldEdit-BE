import { Player } from 'mojang-minecraft';
import { PlayerUtil } from './player_util.js';
import { CustomArgType } from '@library/build/classes/commandBuilder.js';
import { vector, printDebug } from '../util.js';

const directions = ['up', 'down', 'left', 'right', 'forward', 'back', 'north', 'south', 'east', 'west', 'me'];
const dirAliases = ['u', 'd', 'l', 'r', 'f', 'b', 'n', 's', 'e', 'w', 'm'];

const DIRECTIONS: {[k: string]: vector} = {
    'u': [ 0, 1, 0],
    'd': [ 0,-1, 0],
    'n': [ 0, 0,-1],
    's': [ 0, 0, 1],
    'e': [ 1, 0, 0],
    'w': [-1, 0, 0]
}

export class Cardinal implements CustomArgType {
    private direction = 'me';
    
    static parseArgs(args: Array<string>, index = 0) {
        const dir = args[index].toLowerCase();
        if (!directions.includes(dir) && !dirAliases.includes(dir)) {
            throw `Invalid direction: ${args[index]}!`;
            /*printDebug(dir);
            printDebug(dir in directions);*/
        }
        
        const cardinal = new Cardinal();
        cardinal.direction = dir;
        return {result: cardinal, argIndex: index+1};
    }
    
    static clone(original: Cardinal) {
        const cardinal = new Cardinal();
        cardinal.direction = original.direction;
        return cardinal;
    }
    
    getDirection(player: Player) {
        const dirChar = this.direction.charAt(0);
        if (DIRECTIONS[dirChar]) {
            return DIRECTIONS[dirChar];
        } else {
            const dir = PlayerUtil.getDirection(player);
            let cardinal: vector
            const absDir: vector = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
            if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) {
                    cardinal = [Math.sign(dir.x), 0, 0];
            } else if (absDir[2] > absDir[0] && absDir[2] > absDir[1]) {
                    cardinal = [0, 0, Math.sign(dir.z)];
            } else {
                    cardinal = [0, Math.sign(dir.y), 0];
            }
            
            if (dirChar == 'b') {
                    cardinal = cardinal.map(n => {return -n}) as vector;
            } else if (dirChar == 'l' || dirChar == 'r') {
                    cardinal = absDir[0] > absDir[2] ? [Math.sign(dir.x), 0, 0] : [0, 0, Math.sign(dir.z)];
                    if (dirChar == 'r') {
                        cardinal = [-cardinal[2], 0, cardinal[0]];
                    } else {
                        cardinal = [cardinal[2], 0, -cardinal[0]];
                    }
            }
            
            return cardinal;
        }
    }
}