import { Vector3 } from "@minecraft/server";
import { Vector } from "@notbeer-api";

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

export function regionTransformedBounds(start: Vector, end: Vector, origin: Vector, rotate: Vector, flip: Vector) {
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

  return [min.floor(), max.floor()];
}

/**
 * Gives the center of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The center of the space between start and end
 */
export function regionCenter(start: Vector, end: Vector): Vector {
  return new Vector(
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
export function regionSize(start: Vector3, end: Vector3) {
  return new Vector(
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
export function* regionIterateBlocks(start: Vector3, end: Vector3) {
  const [min, max] = regionBounds([start, end]).map(block => Vector.from(block));
  for (let z = min.z; z <= max.z; z++)
    for (let y = min.y; y <= max.y; y++)
      for (let x = min.x; x <= max.x; x++) {
        yield { x, y, z } as Vector3;
      }
}
