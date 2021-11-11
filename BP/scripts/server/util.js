import { BlockLocation, Location } from 'mojang-minecraft';
import { DEBUG } from '../config.js';
import { Server } from '../library/Minecraft.js';
import { RawText } from './modules/rawtext.js';
let serverReady = false;
const printsPending = [];
Server.once('ready', ready => {
    serverReady = true;
    for (const msg of printsPending) {
        printDebug(msg);
    }
    printsPending.length = 0;
});
export function printDebug(data) {
    if (!DEBUG) {
        return;
    }
    let msg;
    if (data instanceof BlockLocation || data instanceof Location) {
        msg = printLocation(data);
    }
    else {
        msg = `${data}`;
    }
    if (serverReady) {
        Server.broadcast('[DEBUG] ' + msg);
    }
    else {
        printsPending.push(msg);
    }
}
export function print(msg, player, toActionBar = false) {
    if (typeof msg == 'string') {
        msg = RawText.text(msg);
    }
    let command;
    if (toActionBar) {
        command = `titleraw "${player.nameTag}" actionbar ${msg.toString()}`;
    }
    else {
        command = `tellraw "${player.nameTag}" ${msg.toString()}`;
    }
    Server.runCommand(command);
}
export function printerr(msg, player, toActionBar = false) {
    print(msg instanceof RawText ? msg.prepend('text', '§c') : ('§c' + msg), player, toActionBar);
}
const worldY = {
    'overworld': [-999, 999],
    'nether': [0, 128],
    'the_end': [0, 128]
};
export function getWorldMinY(player) {
    const dimName = getPlayerDimension(player)[1];
    // Caves and Cliffs?
    if (dimName == 'overworld' && worldY['overworld'][0] == -999) {
        const test = getPlayerBlockLocation(player);
        test.y = -1;
        worldY['overworld'][0] = canPlaceBlock(test) ? -64 : 0;
    }
    return worldY[dimName][0];
}
export function getWorldMaxY(player) {
    const dimName = getPlayerDimension(player)[1];
    // Caves and Cliffs?
    if (dimName == 'overworld' && worldY['overworld'][1] == 999) {
        const test = getPlayerBlockLocation(player);
        test.y = 256;
        worldY['overworld'][1] = canPlaceBlock(test) ? 319 : 255;
    }
    return worldY[dimName][1];
}
export function canPlaceBlock(loc) {
    const locString = printLocation(loc, false);
    Server.runCommand(`structure save canPlaceHere ${locString} ${locString} false memory`);
    const error = Server.runCommand(`structure load canPlaceHere ${locString}`).error;
    Server.runCommand(`structure delete canPlaceHere ${locString}`);
    return !error;
}
export function printLocation(loc, pretty = true) {
    if (pretty)
        return `(${loc.x}, ${loc.y}, ${loc.z})`;
    else
        return `${loc.x} ${loc.y} ${loc.z}`;
}
export function subtractLocations(a, b) {
    return new BlockLocation(a.x - b.x, a.y - b.y, a.z - b.z);
}
export function addLocations(a, b) {
    return new BlockLocation(a.x + b.x, a.y + b.y, a.z + b.z);
}
export function regionVolume(start, end) {
    const size = regionSize(start, end);
    return size.x * size.y * size.z;
}
export function regionBounds(blocks) {
    let min = new BlockLocation(Infinity, Infinity, Infinity);
    let max = new BlockLocation(-Infinity, -Infinity, -Infinity);
    for (const block of blocks) {
        min = regionMin(min, block);
        max = regionMax(max, block);
    }
    return [min, max];
}
export function regionMin(start, end) {
    return new BlockLocation(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.min(start.z, end.z));
}
export function regionMax(start, end) {
    return new BlockLocation(Math.max(start.x, end.x), Math.max(start.y, end.y), Math.max(start.z, end.z));
}
export function regionSize(start, end) {
    return new BlockLocation(Math.abs(start.x - end.x) + 1, Math.abs(start.y - end.y) + 1, Math.abs(start.z - end.z) + 1);
}
