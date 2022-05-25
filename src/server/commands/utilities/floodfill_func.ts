import { contentLog, Vector } from "@notbeer-api";
import { BlockLocation, Dimension } from "mojang-minecraft";
import { locToString, stringToLoc } from "../../util.js";

const offsets = [
    new BlockLocation(-1, 0, 0),
    new BlockLocation( 1, 0, 0),
    new BlockLocation( 0,-1, 0),
    new BlockLocation( 0, 1, 0),
    new BlockLocation( 0, 0,-1),
    new BlockLocation( 0, 0, 1)
];

export interface FloodFillContext {
    pos: BlockLocation
    worldPos: BlockLocation
};

export function* floodFill<T extends FloodFillContext>(start: BlockLocation, size: number, dimension: Dimension, spread: (ctx: T, dir: BlockLocation) => boolean): Generator<void> {
    const initialCtx = {
        pos: new BlockLocation(0, 0, 0),
        worldPos: start.offset(0, 0, 0)
    } as T;
    
    if (!spread({ ...initialCtx }, new BlockLocation(0, 0, 0))) {
        return [];
    }

    const queue: [BlockLocation, T][] = [[start, initialCtx]];
    const result: Map<string, boolean> = new Map();

    function isInside(loc: BlockLocation, ctx: T) {
        if (result.has(locToString(loc)) || Vector.sub(loc, start).length > size) {
            return false;
        }
        return true;
    }

    function addNeighbor(block: BlockLocation, offset: BlockLocation, ctx: T) {
        const neighbor = block.offset(offset.x, offset.y, offset.z);
        ctx.pos = neighbor.offset(-start.x, -start.y, -start.z);
        ctx.worldPos = neighbor;

        queue.push([neighbor, ctx]);
    }

    while (queue.length) {
        const [block, ctx] = queue.shift();

        if (isInside(block, ctx)) {
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