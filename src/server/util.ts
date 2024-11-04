import { Block, Vector3, Dimension, Entity, Player, RawMessage, BlockComponentTypes, BlockPermutation, BlockStates } from "@minecraft/server";
import { Server, RawText, Vector } from "@notbeer-api";
import config from "config.js";

/**
 * Sends a message to a player through either chat or the action bar.
 * @param msg The message to send
 * @param player The one to send the message to
 * @param toActionBar If true the message goes to the player's action bar; otherwise it goes to chat
 */
export function print(msg: string | RawText | RawMessage, player: Player, toActionBar = false) {
    if (typeof msg === "string") msg = <RawText>RawText.translate(msg);
    if (!(msg instanceof RawText)) msg = JSON.stringify(msg);

    let command: string;
    if (toActionBar && config.printToActionBar) {
        command = `titleraw @s actionbar ${msg.toString()}`;
    } else {
        command = `tellraw @s ${msg.toString()}`;
    }
    Server.queueCommand(command, player);
}

/**
 * Acts just like {print} but also prepends '§c' to make the message appear red.
 * @see {print}
 */
export function printerr(msg: string | RawText, player: Player, toActionBar = false) {
    if (!(msg instanceof RawText)) {
        msg = <RawText>RawText.translate(msg);
    }
    print(msg.prepend("text", "§c"), player, toActionBar);
}

export function getViewVector(entity: Entity | Player): Vector3 {
    return entity.getViewDirection();
}

/**
 * Gets the minimum and maximum Y levels of a dimension.
 * @param dim The dimension we're querying.
 * @return The minimum and maximum Y levels.
 */
export function getWorldHeightLimits(dim: Dimension): [number, number] {
    return [dim.heightRange.min, dim.heightRange.max - 1];
}

/**
 * Tests if a block can be placed in a certain location of a dimension.
 * @param loc The location we are testing
 * @param dim The dimension we are testing in
 * @return Whether a block can be placed
 */
export function canPlaceBlock(loc: Vector3, dim: Dimension) {
    try {
        const block = dim.getBlock(loc);
        block.setPermutation(block.permutation);
        return true;
    } catch {
        return false;
    }
}

export function blockHasNBTData(block: Block) {
    const components: `${BlockComponentTypes}`[] = ["minecraft:inventory", "minecraft:sign", "minecraft:piston", "minecraft:record_player", "minecraft:fluidContainer"];
    const nbt_blocks = [
        "minecraft:bee_nest",
        "minecraft:beehive",
        "minecraft:command_block",
        "minecraft:chain_command_block",
        "minecraft:repeating_command_block",
        "minecraft:structure_block",
        "minecraft:flower_pot",
        "minecraft:noteblock",
        "minecraft:mob_spawner",
        "minecraft:standing_banner",
        "minecraft:wall_banner",
        "minecraft:skull",
        "minecraft:snow_layer",
        "minecraft:end_gateway", // TEST
        "minecraft:beacon",
        "minecraft:bed",
    ];
    return components.some((component) => !!block.getComponent(component)) || nbt_blocks.includes(block.typeId);
}

/**
 * Iterates through every possible block permutation for a specified block type.
 */
export function* iterateBlockPermutations(blockType: string) {
    const perm = BlockPermutation.resolve(blockType);
    const properties = Object.keys(perm.getAllStates());
    const values = properties.map((p) => BlockStates.get(p).validValues);

    function* combine(current: any[], depth: number): Generator<Record<string, any>, void> {
        if (depth === values.length) {
            yield Object.fromEntries(current.map((value, i) => [properties[i], value]));
            return;
        }

        for (let i = 0; i < values[depth].length; i++) {
            yield* combine(current.concat(values[depth][i]), depth + 1);
        }
    }
    yield* combine([], 0);
}

/**
 * Converts a location object to a string.
 * @param loc The object to convert
 * @param pretty Whether the function should include brackets and commas in the string. Set to false if you're using this in a command.
 * @return A string representation of the location
 */
export function printLocation(loc: Vector3, pretty = true) {
    if (pretty) return `(${loc.x}, ${loc.y}, ${loc.z})`;
    else return `${loc.x} ${loc.y} ${loc.z}`;
}

/**
 * Converts loc to a string
 */
export function locToString(loc: Vector3) {
    return `${loc.x}_${loc.y}_${loc.z}`;
}

/**
 * Converts string to a Vector
 */
export function stringToLoc(loc: string) {
    return new Vector(...(loc.split("_").map((str) => Number.parseInt(str)) as [number, number, number]));
}

/**
 * Wraps `num` between 0 and `range` exclusive
 */
export function wrap(range: number, num: number) {
    return num >= 0 ? num % range : ((num % range) + range) % range;
}

/**
 * Snaps `num` to the nearest `interval`
 */
export function snap(num: number, interval: number) {
    return Math.round(num / interval) * interval;
}

/**
 * Tests if two array are equal to each other
 * @param a First array
 * @param b Second array
 * @param compare A function to test if two values from the arrays are equal. Should return true if so.
 */
export function arraysEqual<T>(a: T[], b: T[], compare: (a: T, b: T) => boolean) {
    if (a.length != b.length) return false;
    return !a.some((valA, i) => {
        const valB = b[i];
        if (!!valA != !!valB) return true;
        return !compare(valA, valB);
    });
}
