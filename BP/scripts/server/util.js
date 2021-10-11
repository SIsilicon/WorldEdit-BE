import { BlockLocation, Location, World } from 'mojang-minecraft';
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
    return;
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
    let command = msg instanceof RawText ? msg.toString() : `${msg}`;
    let appendRaw = msg instanceof RawText ? 'raw' : '';
    if (toActionBar) {
        command = `title${appendRaw} ${player.nameTag} actionbar ` + command;
    }
    else {
        command = `tell${appendRaw} ${player.nameTag} ` + command;
    }
    Server.runCommand(command);
}
export function printerr(msg, player, toActionBar = false) {
    print(msg instanceof RawText ? msg.prepend('text', '§c') : ('§c' + msg), player, toActionBar);
}
export function playerHasItem(player, item) {
    return !Server.runCommand(`clear ${player.nameTag} ${item} 0 0`).error;
}
export function getPlayerBlockLocation(player) {
    return new BlockLocation(Math.floor(player.location.x), Math.floor(player.location.y - 1.61), // Account for player height
    Math.floor(player.location.z));
}
export function requestPlayerDirection(player) {
    return new Promise((resolve) => {
        const locA = getPlayerBlockLocation(player);
        let locB;
        const dimension = getPlayerDimension(player)[1];
        const onSpawn = (entity) => {
            if (entity.id == 'wedit:direction_marker' ||
                entity.id == 'unknown' && entity.getComponent('minecraft:health')?.value == 48927) {
                locB = entity.location;
                entity.nameTag = 'wedit:pending_deletion_of_selector';
                Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
                entity.kill();
                let dir = [locB.x - locA.x, locB.y - locA.y, locB.z - locA.z];
                const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
                dir = dir.map(v => { return v / len; });
                Server.off('entityCreate', onSpawn);
                resolve(new Location(dir[0], dir[1], dir[2]));
            }
        };
        Server.prependOnceListener('entityCreate', onSpawn);
        Server.runCommand(`execute ${player.nameTag} ~~~ summon wedit:direction_marker ^^^20`, dimension);
    });
}
const playerDimensions = {};
export function getPlayerDimension(player) {
    const blockLoc = getPlayerBlockLocation(player);
    for (const dimName of ['overworld', 'nether', 'the end']) {
        const dimension = World.getDimension(dimName);
        const entities = dimension.getEntitiesAtBlockLocation(blockLoc);
        for (const entity of entities) {
            if (entity.id == 'minecraft:player' && entity.nameTag == player.nameTag) {
                playerDimensions[player.nameTag] = [dimension, dimName];
                return [dimension, dimName];
            }
        }
    }
    return playerDimensions[player.nameTag] || [null, null];
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
