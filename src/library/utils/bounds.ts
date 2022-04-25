import { BlockLocation } from "mojang-minecraft";

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