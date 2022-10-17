import { BlockLocation } from "@minecraft/server";
import { Vector } from "./vector.js";

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

export function regionTransformedBounds(start: BlockLocation, end: BlockLocation, origin: Vector, rotate: Vector, flip: Vector) {
  const corners = [
    new Vector(start.x, start.y, start.z),
    new Vector(start.x, start.y, end.z),
    new Vector(start.x, end.y, start.z),
    new Vector(start.x, end.y, end.z),
    new Vector(end.x, start.y, start.z),
    new Vector(end.x, start.y, end.z),
    new Vector(end.x, end.y, start.z),
    new Vector(end.x, end.y, end.z),
  ].map(vec => vec.sub(origin).rotateY(rotate.y).rotateX(rotate.x).rotateZ(rotate.z).mul(flip).add(origin));

  let [min, max] = [Vector.INF, Vector.NEG_INF];
  corners.forEach(vec => min = min.min(vec));
  corners.forEach(vec => max = max.max(vec));

  return [min.toBlock(), max.toBlock()];
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

/**
 * Generates blocks that exist between `start` and `end`
 * @param start
 * @param end
 */
export function* regionIterateBlocks(start: BlockLocation, end: BlockLocation) {
  const [min, max] = regionBounds([start, end]).map(block => Vector.from(block));
  const size = regionSize(min.toBlock(), max.toBlock());
  const maxSize = 32;

  for (let z = 0; z < size.z; z += maxSize)
    for (let y = 0; y < size.y; y += maxSize)
      for (let x = 0; x < size.x; x += maxSize) {
        const subStart = min.add([x, y, z]).toBlock();
        const subEnd = Vector.min(
          new Vector(x, y, z).add(maxSize), size
        ).add(min).sub(Vector.ONE).toBlock();

        for (const block of subStart.blocksBetween(subEnd))
          yield block;
      }
}
