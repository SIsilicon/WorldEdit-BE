import { BlockLocation, Dimension, Location, Player, world } from 'mojang-minecraft';
import { CONTENT_LOG, DEBUG, PRINT_TO_ACTION_BAR } from '../config.js';
import { Server, RawText, contentLog } from '@notbeer-api';
import { parsedBlock } from './modules/parser.js';

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
    
    Server.broadcast('[DEBUG] ' + msg);
}

/**
 * Prints a message to content log.
 * @param data The data to be printed.
 */
export function printLog(...data: any[]) {
    if (!CONTENT_LOG) {
        return;
    }
    
    contentLog.log(...data);
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

const worldY = new Map<string, [number, number]>([
    ['minecraft:overworld', [-64, 319]],
    ['minecraft:nether', [0, 127]],
    ['minecraft:the_end', [0, 255]],
    ['', [0, 0]]
]);

/**
 * Gets the minimum Y level of the dimension a player is in.
 * @param player The player whose dimension we're testing
 * @return The minimum Y level of the dimension the player is in
 */
export function getWorldMinY(player: Player) {
    return worldY.get(player.dimension.id)[0];
}

/**
 * Gets the maximum Y level of the dimension a player is in.
 * @param player The player whose dimension we're testing
 * @return The maximum Y level of the dimension the player is in
 */
export function getWorldMaxY(player: Player) {
    return worldY.get(player.dimension.id)[1];
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
 * Converts loc to a string
 */
export function locToString(loc: BlockLocation) {
    return `${loc.x}_${loc.y}_${loc.z}`;
}

/**
 * Converts string to a BlockLocation
 */
export function stringToLoc(loc: string) {
    return new BlockLocation(...loc.split('_').map(str => Number.parseInt(str)) as [number, number, number])
}

