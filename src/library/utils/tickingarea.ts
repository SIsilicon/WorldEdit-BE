import { Server, Vector } from "@notbeer-api";
import { Vector3, Dimension, world } from "@minecraft/server";

const DIMENSIONS = ["overworld", "nether", "the_end"];

/**
 * Sets a ticking area in a cuboid region to load chunks. Note that chunks don't get loaded immediately.
 * @returns `true` when created successfully; `false` otherwise.
 */
export function setTickingArea(start: Vector3, end: Vector3, dimension: Dimension, name: string) {
    const removed = removeTickingArea(name, dimension);
    return !!Server.runCommand(`tickingarea add ${Vector.from(start).print()} ${Vector.from(end).print()} ${name}`, dimension).successCount || removed;
}

/**
 * Sets a ticking area in a circular region to load chunks. Note that chunks don't get loaded immediately.
 * @returns `true` when created successfully; `false` otherwise.
 */
export function setTickingAreaCircle(center: Vector3, radius: 1 | 2 | 3 | 4, dimension: Dimension, name: string) {
    const removed = removeTickingArea(name, dimension);
    const result = Server.runCommand(`tickingarea add circle ${Vector.from(center).print()} ${radius} ${name}`, dimension);
    return !!result.successCount || removed;
}

/** Removes a ticking area. */
export function removeTickingArea(name: string, dimension?: Dimension) {
    if (dimension) {
        return !!Server.runCommand(`tickingarea remove ${name}`, dimension).successCount;
    } else {
        DIMENSIONS.forEach((d) => Server.runCommand(`tickingarea remove ${name}`, world.getDimension(d)));
    }
}
