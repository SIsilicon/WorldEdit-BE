import { Dimension, Vector3, BlockPermutation, Block } from "@minecraft/server";
import { Vector, iterateChunk, whenReady } from "@notbeer-api";
import { BlockUnit } from "./block_parsing";
import { PlayerSession } from "server/sessions";
import { History } from "./history";

export interface BlockChanges {
    readonly dimension: Dimension;

    getBlockPerm(loc: Vector3): BlockPermutation;
    getBlock(loc: Vector3): BlockUnit;
    setBlock(loc: Vector3, block: BlockPermutation): void;

    applyIteration(): void;
    flush(): Generator<any>;
}

let air: BlockPermutation;
whenReady(() => (air = BlockPermutation.resolve("minecraft:air")));

export function recordBlockChanges(session: PlayerSession, historyPoint: number): BlockChanges {
    return new BlockChangeImpl(session.player.dimension, session.history, historyPoint);
}

class BlockChangeImpl implements BlockChanges {
    readonly dimension: Dimension;
    private blockCache = new Map<string, Block>();
    private iteration = new Map<string, BlockPermutation>();
    private changes = new Map<string, BlockPermutation>();
    private ranges: [Vector, Vector][] = [];
    private history: History;
    private record: number;

    constructor(dim: Dimension, history: History, record: number) {
        this.dimension = dim;
        this.history = history;
        this.record = record;
    }

    getBlockPerm(loc: Vector3) {
        const key = this.vec2string(loc);
        const change = this.changes.get(key);
        try {
            if (change) return change;
            if (!this.blockCache.has(key)) this.blockCache.set(key, this.dimension.getBlock(loc));
            return this.blockCache.get(key).permutation ?? air;
        } catch {
            return air;
        }
    }

    getBlock(loc: Vector3): BlockUnit {
        const perm = this.getBlockPerm(loc);
        return {
            x: loc.x,
            y: loc.y,
            z: loc.z,

            typeId: perm.type.id,
            permutation: perm,
            location: loc,
            dimension: this.dimension,
            setPermutation: (perm: BlockPermutation) => this.setBlock(loc, perm),
            hasTag: perm.hasTag,
            get isAir() {
                return perm.type.id == "minecraft:air" ? true : false;
            },
        };
    }

    setBlock(loc: Vector3, block: BlockPermutation) {
        this.iteration.set(this.vec2string(loc), block);
        if (!this.ranges.length) {
            this.ranges.push([Vector.from(loc), Vector.from(loc)]);
        } else {
            const [min, max] = this.ranges[0];
            min.x = Math.min(min.x, loc.x);
            min.y = Math.min(min.y, loc.y);
            min.z = Math.min(min.z, loc.z);
            max.x = Math.max(max.x, loc.x);
            max.y = Math.max(max.y, loc.y);
            max.z = Math.max(max.z, loc.z);
        }
    }

    applyIteration() {
        if (!this.iteration.size) return;
        this.changes = new Map([...this.changes, ...this.iteration]);
        this.iteration.clear();
    }

    getRegion() {
        return this.ranges.map((v) => [v[0], v[1]]);
    }

    *flush() {
        this.applyIteration();
        for (const range of this.ranges) yield* this.history.trackRegion(this.record, ...range);

        let i = 0;
        for (const [loc, block] of this.changes.entries()) {
            try {
                this.blockCache.get(loc).setPermutation(block);
            } catch {
                /* pass */
            }
            i++;
            if (iterateChunk) yield i;
        }

        this.ranges.length = 0;
        this.changes.clear();
    }

    private vec2string(vec: Vector3) {
        return "" + vec.x + "_" + vec.y + "_" + vec.z;
    }
}
