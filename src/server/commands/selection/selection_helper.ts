import { BlockLocation } from 'mojang-minecraft';

export function parsePosition(args: string[], loc: BlockLocation, offset = 0) {
    if (args.length < 3) {
        throw 'You need to specifiy all three parts of the coordinates!';
    }
    if (args.length > 3) {
        throw 'Too many arguments specified!';
    }

    const playerLoc = [loc.x, loc.y, loc.z];
    const coords: number[] = [];
    for (let i = 0; i < 3; i++) {
        let arg = args[i + offset];
        let relative = false;
        
        if (arg.includes('~')) {
            arg = arg.slice(1);
            relative = true;
        }

        let number = arg ? parseInt(arg) : 0;
        if (isNaN(number)) {
            throw 'One of the arguments is an invalid integer!';
        }
        if (relative) {
            number += playerLoc[i];
        }
        coords.push(number);
    }
    return new BlockLocation(coords[0], coords[1], coords[2]);
}