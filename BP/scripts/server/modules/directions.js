import { requestPlayerDirection } from '../util.js';
const directions = ['up', 'down', 'left', 'right', 'forward', 'back', 'north', 'south', 'east', 'west', 'me'];
const dirAliases = ['u', 'd', 'l', 'r', 'f', 'b', 'n', 's', 'e', 'w', 'm'];
const DIRECTIONS = {
    'u': [0, 1, 0],
    'd': [0, -1, 0],
    'n': [0, 0, -1],
    's': [0, 0, 1],
    'e': [1, 0, 0],
    'w': [-1, 0, 0]
};
export function getDirection(direction, player) {
    return new Promise((resolve) => {
        const dirChar = direction.charAt(0);
        if (DIRECTIONS[dirChar]) {
            resolve(DIRECTIONS[dirChar]);
        }
        else {
            PlayerUtil.requestDirection(player).then(dir => {
                let cardinal;
                const absDir = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
                if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) {
                    cardinal = [Math.sign(dir.x), 0, 0];
                }
                else if (absDir[2] > absDir[0] && absDir[2] > absDir[1]) {
                    cardinal = [0, 0, Math.sign(dir.z)];
                }
                else {
                    cardinal = [0, Math.sign(dir.y), 0];
                }
                if (dirChar == 'b') {
                    cardinal = cardinal.map(n => { return -n; });
                }
                else if (dirChar == 'l' || dirChar == 'r') {
                    cardinal = absDir[0] > absDir[2] ? [Math.sign(dir.x), 0, 0] : [0, 0, Math.sign(dir.z)];
                    if (dirChar == 'r') {
                        cardinal = [-cardinal[2], 0, cardinal[0]];
                    }
                    else {
                        cardinal = [cardinal[2], 0, -cardinal[0]];
                    }
                }
                resolve(cardinal);
            });
        }
    });
}
