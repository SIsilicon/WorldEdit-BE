import { Dimension, Vector3 } from "@minecraft/server";
import { Matrix, Vector } from "@notbeer-api";

/**
 * Gives the volume of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The volume of the space between start and end
 */
export function regionVolume(start: Vector3, end: Vector3) {
    const size = regionSize(start, end);
    return size.x * size.y * size.z;
}

/**
 * Calculates the minimum and maximum of a set of block locations
 * @param blocks The set of blocks
 * @return The minimum and maximum
 */
export function regionBounds(blocks: Vector3[]): [Vector3, Vector3] {
    let min: Vector;
    let max: Vector;
    for (const block of blocks) {
        if (!min) {
            min = new Vector(block.x, block.y, block.z);
            max = new Vector(block.x, block.y, block.z);
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

export function regionTransformedBounds(start: Vector, end: Vector, transform: Matrix) {
    end = end.add(1);
    const corners = [
        new Vector(start.x, start.y, start.z),
        new Vector(start.x, start.y, end.z),
        new Vector(start.x, end.y, start.z),
        new Vector(start.x, end.y, end.z),
        new Vector(end.x, start.y, start.z),
        new Vector(end.x, start.y, end.z),
        new Vector(end.x, end.y, start.z),
        new Vector(end.x, end.y, end.z),
    ].map((vec) => vec.transform(transform));

    let [min, max] = [Vector.INF, Vector.NEG_INF];
    corners.forEach((vec) => (min = min.min(vec)));
    corners.forEach((vec) => (max = max.max(vec)));

    return [min.floor(), max.sub(1).ceil()] as [Vector, Vector];
}

/**
 * Gives the center of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The center of the space between start and end
 */
export function regionCenter(start: Vector3, end: Vector3): Vector {
    return new Vector(Math.floor(start.x + (end.x - start.x) * 0.5), Math.floor(start.y + (end.y - start.y) * 0.5), Math.floor(start.z + (end.z - start.z) * 0.5));
}

/**
 * Gets the size of a region across its three axis.
 * @param start The first corner of the region
 * @param end The second corner of the region
 * @return The size of the region
 */
export function regionSize(start: Vector3, end: Vector3) {
    return new Vector(Math.abs(start.x - end.x) + 1, Math.abs(start.y - end.y) + 1, Math.abs(start.z - end.z) + 1);
}

/**
 * Generates blocks that exist between `start` and `end`
 * @param start
 * @param end
 */
export function* regionIterateBlocks(start: Vector3, end: Vector3, centered = false) {
    let [min, max] = regionBounds([start, end]).map((block) => Vector.from(block));
    if (centered) {
        min = min.add(0.5);
        max = max.add(0.5);
    }
    for (let z = min.z; z <= max.z; z++) {
        for (let y = min.y; y <= max.y; y++) {
            for (let x = min.x; x <= max.x; x++) {
                yield { x, y, z } as Vector3;
            }
        }
    }
}

/**
 * Generates chunks that exist between `start` and `end`
 * @param start
 * @param end
 */
export function* regionIterateChunks(start: Vector3, end: Vector3, ySubChunks = true) {
    const [min, max] = regionBounds([start, end]).map((block) => Vector.from(block));
    const minChunk = min
        .mul(1 / 16)
        .floor()
        .mul(16);
    const maxChunk = max
        .mul(1 / 16)
        .floor()
        .mul(16)
        .add(16);
    for (let chunkZ = minChunk.z; chunkZ < maxChunk.z; chunkZ += 16) {
        for (let chunkX = minChunk.x; chunkX < maxChunk.x; chunkX += 16) {
            if (ySubChunks) {
                for (let chunkY = minChunk.y; chunkY < maxChunk.y; chunkY += 16) {
                    const chunk = new Vector(chunkX, chunkY, chunkZ);
                    yield [min.max(chunk), max.min(chunk.add(15))];
                }
            } else {
                const chunk = new Vector(chunkX, minChunk.y, chunkZ);
                yield [min.max(chunk), max.min(chunk.add(15))];
            }
        }
    }
}

export function regionLoaded(start: Vector3, end: Vector3, dimension: Dimension) {
    for (const chunk of regionIterateChunks(start, end, false)) {
        if (!dimension.getBlock(chunk[0])) return false;
    }
    return true;
}
