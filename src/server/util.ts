import { BlockLocation, Dimension, Entity, Location, Player, EntityQueryOptions } from 'mojang-minecraft';
import { DEBUG, PRINT_TO_ACTION_BAR } from '../config.js';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { parsedBlock } from '@modules/parser.js';

// Server broadcast doesn't print anything until the first player has loaded.
let serverReady = false;
const printsPending: string[] = [];
Server.once('ready', ready => {
    serverReady = true;
    for (const msg of printsPending) {
        printDebug(msg);
    }
    printsPending.length = 0;
});

/**
 * Prints a message or object to chat for debugging.
 * @remark Doesn't do anything if {DEBUG} is disabled.
 * @param data The data to be printed to chat.
 */
export function printDebug(...data: any[]) {
    if (!DEBUG) {
        return;
    }

    let msg = '';
    data.forEach(data => {
        if (data instanceof BlockLocation || data instanceof Location) {
            msg += ' ' + printLocation(<BlockLocation> data);
        } else {
            msg += ` ${data}`;
        }
    });

    if (serverReady) {
        Server.broadcast('[DEBUG] ' + msg);
    } else {
        printsPending.push(msg);
    }
}

/**
 * Sends a message to a player through either chat or the action bar.
 * @param msg The message to send
 * @param player The one to send the message to
 * @param toActionBar If true the message goes to the player's action bar; otherwise it goes to chat
 */
export function print(msg: string | RawText, player: Player, toActionBar = false) {
    if (typeof msg == 'string') {
        msg = <RawText> RawText.translate(msg);
    }
    let command: string;
    if (toActionBar && PRINT_TO_ACTION_BAR) {
        command = `titleraw @s actionbar ${msg.toString()}`;
    } else {
        command = `tellraw @s ${msg.toString()}`;
    }
    Server.runCommand(command, player);
}

/**
 * Acts just like {print} but also prepends '§c' to make the message appear red.
 * @see {print}
 */
export function printerr(msg: string | RawText, player: Player, toActionBar = false) {
    if (!(msg instanceof RawText)) {
        msg = <RawText> RawText.translate(msg);
    }
    print(msg.prepend('text', '§c'), player, toActionBar);
}

const worldY = {
    'overworld': [-64, 319],
    'nether': [0, 127],
    'the end': [0, 255],
    '': [0, 0]
};
/**
 * Gets the minimum Y level of the dimension a player is in.
 * @param player The player whose dimension we're testing
 * @return The minimum Y level of the dimension the player is in
 */
export function getWorldMinY(player: Player) {
    return worldY[PlayerUtil.getDimensionName(player)][0];
}

/**
 * Gets the maximum Y level of the dimension a player is in.
 * @param player The player whose dimension we're testing
 * @return The maximum Y level of the dimension the player is in
 */
export function getWorldMaxY(player: Player) {
    return worldY[PlayerUtil.getDimensionName(player)][1];
}

/**
 * Tests if a block can be placed in a certain location of a dimension.
 * @param loc The location we are testing
 * @param dim The dimension we are testing in
 * @return Whether a block can be placed
 */
export function canPlaceBlock(loc: BlockLocation, dim: Dimension) {
    const locString = printLocation(loc, false);
    let error = Server.runCommand(`structure save canPlaceHere ${locString} ${locString} false memory`, dim).error;
    if (!error) {
        error = Server.runCommand(`structure load canPlaceHere ${locString}`, dim).error;
        Server.runCommand(`structure delete canPlaceHere ${locString}`, dim);
    }
    return !error;
}

/**
 * Places a block in the location of a dimension
 */
export function placeBlock(block: parsedBlock, loc: BlockLocation, dim: Dimension) {
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
    return Server.runCommand(`setblock ${printLocation(loc, false)} ${command}`, dim).error;
}

/**
 * Converts a location object to a string.
 * @param loc The object to convert
 * @param pretty Whether the function should include brackets and commas in the string. Set to false if you're using this in a command.
 * @return A string representation of the location
 */
export function printLocation(loc: BlockLocation | Location, pretty = true) {
    if (pretty)
        return `(${loc.x}, ${loc.y}, ${loc.z})`;
    else
        return `${loc.x} ${loc.y} ${loc.z}`;
}

/**
 * Gives the volume of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The volume of the space between start and end
 */
export function regionVolume(start: BlockLocation, end: BlockLocation) {
    const size = regionSize(start, end);
    return size.x * size.y * size.z;
}

/**
 * Calculates the minimum and maximum of a set of block locations
 * @param blocks The set of blocks
 * @return The minimum and maximum
 */
export function regionBounds(blocks: BlockLocation[]): [BlockLocation, BlockLocation] {
    let min: BlockLocation;
    let max: BlockLocation;
    for (const block of blocks) {
        if (!min) {
            min = new BlockLocation(block.x, block.y, block.z);
            max = new BlockLocation(block.x, block.y, block.z);
        }
        min.x = Math.min(block.x, min.x);
        min.y = Math.min(block.y, min.y);
        min.z = Math.min(block.z, min.z);
        max.x = Math.max(block.x, max.x);
        max.y = Math.max(block.y, max.y);
        max.z = Math.max(block.z, max.z);
    }
    return [min, max];
}

/**
 * Gives the center of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The center of the space between start and end
 */
export function regionCenter(start: BlockLocation, end: BlockLocation): BlockLocation {
    return new BlockLocation(
        Math.floor(start.x + (end.x - start.x) * 0.5),
        Math.floor(start.y + (end.y - start.y) * 0.5),
        Math.floor(start.z + (end.z - start.z) * 0.5)
    );
}

/**
 * Gets the size of a region across its three axis.
 * @param start The first corner of the region
 * @param end The second corner of the region
 * @return The size of the region
 */
export function regionSize(start: BlockLocation, end: BlockLocation) {
    return new BlockLocation(
        Math.abs(start.x - end.x) + 1,
        Math.abs(start.y - end.y) + 1,
        Math.abs(start.z - end.z) + 1
    );
}