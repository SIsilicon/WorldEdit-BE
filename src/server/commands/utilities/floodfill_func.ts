import { Vector, VectorSet } from "@notbeer-api";
import { Block, Vector3, VectorXZ } from "@minecraft/server";
import { Jobs } from "@modules/jobs.js";

const offsets = [new Vector(-1, 0, 0), new Vector(1, 0, 0), new Vector(0, -1, 0), new Vector(0, 1, 0), new Vector(0, 0, -1), new Vector(0, 0, 1)];

function getChunkKey(pos: Vector3) {
    return `${pos.x >> 4},${pos.z >> 4}`;
}

function parseCoordinates(key: string) {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
}

function calculateDistance(point1: VectorXZ, point2: VectorXZ) {
    return (point1.x - point2.x) ** 2 + (point1.z - point2.z) ** 2;
}

function findClosestEntry<T>(map: Map<string, T>, target: VectorXZ) {
    let closestEntry: [string, T] | undefined;
    let closestDistance = Infinity;

    for (const [key, value] of map.entries()) {
        const coords = parseCoordinates(key);
        const distance = calculateDistance(coords, target);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestEntry = [key, value];
        }
    }

    return closestEntry;
}

export interface FloodFillContext {
    pos: Vector;
    worldPos: Vector;
    nextBlock: Block;
}

export function* floodFill<T extends FloodFillContext>(start: Vector3, size: number, spread: (ctx: T, dir: Vector3) => boolean): Generator<void | Promise<unknown>, VectorSet<Vector>> {
    const initialCtx = {
        pos: Vector.ZERO,
        worldPos: Vector.from(start),
        nextBlock: yield* Jobs.loadBlock(start),
    } as T;

    if (!spread({ ...initialCtx }, Vector.ZERO)) return new VectorSet<Vector>();

    const dimension = Jobs.getRunner().dimension;
    const chunks: Map<string, [Vector, T][]> = new Map();
    const queue: [Vector, T][] = [[Vector.from(start), initialCtx]];
    const result = new VectorSet<Vector>();
    let currentChunk: string = getChunkKey(start);

    function addNeighbor(block: Vector, offset: Vector, ctx: T) {
        const neighbor = block.offset(offset.x, offset.y, offset.z);
        ctx.pos = neighbor.offset(-start.x, -start.y, -start.z);
        ctx.worldPos = neighbor;

        const chunkKey = getChunkKey(neighbor);
        if (chunkKey !== currentChunk) {
            if (!chunks.has(chunkKey)) chunks.set(chunkKey, []);
            chunks.get(chunkKey)!.push([neighbor, ctx]);
        } else {
            queue.push([neighbor, ctx]);
        }
    }

    while (queue.length) {
        const [block, ctx] = queue.shift()!;

        if (!result.has(block) && Vector.sub(block, start).length <= size + 0.5) {
            result.add(block);
            for (const offset of offsets) {
                const nextBlockLoc = Vector.add(block, offset);
                const newCtx = { ...ctx, nextBlock: dimension.getBlock(nextBlockLoc) ?? (yield* Jobs.loadBlock(nextBlockLoc)) };
                try {
                    if (spread(newCtx, offset)) {
                        addNeighbor(block, offset, newCtx);
                        // system.run(() => dimension.spawnParticle("minecraft:basic_flame_particle", nextBlockLoc));
                    }
                } catch {
                    /* pass */
                }
            }
        }

        yield;

        if (!queue.length && chunks.size) {
            const [chunkKey, chunk] = findClosestEntry(chunks, parseCoordinates(currentChunk));
            if (!chunk) continue;

            currentChunk = chunkKey;
            queue.push(...chunk);
            chunks.delete(chunkKey);
        }
    }

    return result;
}
