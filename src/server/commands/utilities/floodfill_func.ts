import { Vector } from "@notbeer-api";
import { Vector3, Dimension } from "@minecraft/server";
import { locToString, stringToLoc } from "../../util.js";

const offsets = [
  new Vector(-1, 0, 0),
  new Vector( 1, 0, 0),
  new Vector( 0,-1, 0),
  new Vector( 0, 1, 0),
  new Vector( 0, 0,-1),
  new Vector( 0, 0, 1)
];

export interface FloodFillContext {
    pos: Vector
    worldPos: Vector
}

export function* floodFill<T extends FloodFillContext>(start: Vector3, size: number, dimension: Dimension, spread: (ctx: T, dir: Vector3) => boolean): Generator<void> {
  const initialCtx = {
    pos: Vector.ZERO,
    worldPos: Vector.from(start)
  } as T;

  if (!spread({ ...initialCtx }, Vector.ZERO)) {
    return [];
  }

  const queue: [Vector, T][] = [[Vector.from(start), initialCtx]];
  const result: Map<string, boolean> = new Map();

  function isInside(loc: Vector3) {
    if (result.has(locToString(loc)) || Vector.sub(loc, start).length > size+0.5) {
      return false;
    }
    return true;
  }

  function addNeighbor(block: Vector, offset: Vector, ctx: T) {
    const neighbor = block.offset(offset.x, offset.y, offset.z);
    ctx.pos = neighbor.offset(-start.x, -start.y, -start.z);
    ctx.worldPos = neighbor;

    queue.push([neighbor, ctx]);
  }

  while (queue.length) {
    const [block, ctx] = queue.shift();

    if (isInside(block)) {
      result.set(locToString(block), true);
      for (const offset of offsets) {
        const newCtx = {...ctx};
        if (spread(newCtx, offset)) {
          addNeighbor(block, offset, newCtx);
        }
      }
    }

    yield;
  }

  return Array.from(result.keys()).map(str => stringToLoc(str));
}