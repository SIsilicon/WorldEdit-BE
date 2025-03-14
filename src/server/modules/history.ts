import { Vector3, Dimension, BlockPermutation, Block } from "@minecraft/server";
import { Vector, regionVolume, regionSize, Thread, getCurrentThread, iterateChunk, VectorSet } from "@notbeer-api";
import { UnloadedChunksError } from "./assert.js";
import { canPlaceBlock } from "../util.js";
import { PlayerSession } from "../sessions.js";
import { selectMode } from "./selection.js";
import { BlockUnit } from "./block_parsing.js";
import config from "config.js";
import { Jobs } from "./jobs.js";
import { RegionBuffer } from "./region_buffer.js";

type historyEntry = {
    buffer: RegionBuffer;
    dimension: Dimension;
    location: Vector3;
    size: Vector3;
};

type selectionEntry = {
    type: selectMode;
    points: Vector[];
};

type historyPoint = {
    undo: historyEntry[];
    redo: historyEntry[];
    selection: [selectionEntry, selectionEntry] | selectionEntry | "none";

    blockChange: BlockChanges;
    blocksChanged: number;
    brush: boolean;
    thread: Thread;
};

const air = BlockPermutation.resolve("minecraft:air");

let historyPointId = 0;

export class History {
    private historyPoints = new Map<number, historyPoint>();

    private undoStructures: historyEntry[][] = [];
    private redoStructures: historyEntry[][] = [];
    private selectionHistory: historyPoint["selection"][] = [];
    private historyIdx = -1;

    private session: PlayerSession;

    constructor(session: PlayerSession) {
        this.session = session;
    }

    record(brush = false) {
        historyPointId++;
        const historyPoint = {
            undo: [] as historyEntry[],
            redo: [] as historyEntry[],
            selection: "none",

            blockChange: new BlockChangeImpl(this.session.getPlayer().dimension, this, historyPointId),
            blocksChanged: 0,
            thread: getCurrentThread(),
            brush,
        } as historyPoint;
        this.historyPoints.set(historyPointId, historyPoint);
        return historyPointId;
    }

    commit(historyPoint: number) {
        const point = this.historyPoints.get(historyPoint);
        this.historyPoints.delete(historyPoint);

        this.historyIdx++;
        for (let i = this.historyIdx; i < this.undoStructures.length; i++) {
            this.deleteHistoryRegions(i);
        }
        this.undoStructures.length = this.redoStructures.length = this.selectionHistory.length = this.historyIdx + 1;

        this.undoStructures[this.historyIdx] = point.undo;
        this.redoStructures[this.historyIdx] = point.redo;
        this.selectionHistory[this.historyIdx] = point.selection;

        while (this.historyIdx > config.maxHistorySize - 1) {
            this.deleteHistoryRegions(0);
            this.undoStructures.shift();
            this.redoStructures.shift();
            this.selectionHistory.shift();
            this.historyIdx--;
        }
    }

    cancel(historyPoint: number) {
        if (!this.historyPoints.has(historyPoint)) return;

        const point = this.historyPoints.get(historyPoint);
        this.historyPoints.delete(historyPoint);

        for (const struct of point.undo) struct.buffer.deref();
        for (const struct of point.redo) struct.buffer.deref();
    }

    collectBlockChanges(historyPoint: number) {
        return this.historyPoints.get(historyPoint)?.blockChange;
    }

    *addUndoStructure(historyPoint: number, start: Vector3, end: Vector3, blocks: Vector3[] | VectorSet | "any" = "any") {
        // contentLog.debug("adding undo structure");
        const point = this.historyPoints.get(historyPoint);
        point.blocksChanged += blocks == "any" ? regionVolume(start, end) : Array.isArray(blocks) ? blocks.length : blocks.size;
        // We test the change limit here,
        if (point.blocksChanged > this.session.changeLimit) throw "commands.generic.wedit:blockLimit";

        const buffer = yield* this.processRegion(historyPoint, start, end);
        point.undo.push({
            buffer,
            dimension: this.session.getPlayer().dimension,
            location: Vector.min(start, end).floor(),
            size: regionSize(start, end),
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    *addRedoStructure(historyPoint: number, start: Vector3, end: Vector3, blocks: Vector3[] | VectorSet | "any" = "any") {
        const point = this.historyPoints.get(historyPoint);
        this.assertRecording();

        const buffer = yield* this.processRegion(historyPoint, start, end);
        point.redo.push({
            buffer,
            dimension: this.session.getPlayer().dimension,
            location: Vector.min(start, end).floor(),
            size: regionSize(start, end),
        });
    }

    recordSelection(historyPoint: number, session: PlayerSession) {
        const point = this.historyPoints.get(historyPoint);
        if (point.selection == "none") {
            point.selection = {
                type: session.selection.mode,
                points: session.selection.points,
            };
        } else if ("points" in point.selection) {
            point.selection = [
                point.selection,
                {
                    type: session.selection.mode,
                    points: session.selection.points,
                },
            ];
        } else {
            throw new Error('Cannot call "recordSelection" more than two times!');
        }
    }

    *undo(session: PlayerSession) {
        this.assertNotRecording();
        if (this.historyIdx <= -1) return true;

        const player = this.session.getPlayer();
        const dim = player.dimension;
        for (const region of this.undoStructures[this.historyIdx]) {
            yield* region.buffer.load(region.location, dim);
        }

        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) {
            selection = (<[selectionEntry, selectionEntry]>this.selectionHistory[this.historyIdx])[0];
        } else if (this.selectionHistory[this.historyIdx] != "none") {
            selection = <selectionEntry>this.selectionHistory[this.historyIdx];
        }
        if (selection) {
            session.selection.mode = selection.type;
            for (let i = 0; i < selection.points.length; i++) {
                session.selection.set(i == 0 ? 0 : 1, selection.points[i]);
            }
        }
        this.historyIdx--;

        return false;
    }

    *redo(session: PlayerSession) {
        this.assertNotRecording();
        if (this.historyIdx >= this.redoStructures.length - 1) return true;

        const player = this.session.getPlayer();
        const dim = player.dimension;
        this.historyIdx++;
        for (const region of this.redoStructures[this.historyIdx]) {
            yield* region.buffer.load(region.location, dim);
        }

        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) {
            selection = (<[selectionEntry, selectionEntry]>this.selectionHistory[this.historyIdx])[1];
        } else if (this.selectionHistory[this.historyIdx] != "none") {
            selection = <selectionEntry>this.selectionHistory[this.historyIdx];
        }
        if (selection) {
            session.selection.mode = selection.type;
            for (let i = 0; i < selection.points.length; i++) {
                session.selection.set(i == 0 ? 0 : 1, selection.points[i]);
            }
        }

        return false;
    }

    clear() {
        this.historyIdx = -1;
        for (let i = 0; i < this.undoStructures.length; i++) {
            this.deleteHistoryRegions(i);
        }
        this.undoStructures.length = 0;
        this.redoStructures.length = 0;
    }

    isRecording() {
        return this.historyPoints.size != 0;
    }

    getActivePointsInThread(thread: Thread) {
        const points = [];
        for (const [point, data] of this.historyPoints.entries()) {
            if (data.thread === thread) points.push(point);
        }
        return points;
    }

    delete() {
        do {
            this.deleteHistoryRegions(0);
        } while (this.undoStructures.shift());
    }

    private deleteHistoryRegions(index: number) {
        try {
            for (const struct of this.undoStructures[index]) struct.buffer.deref();
            for (const struct of this.redoStructures[index]) struct.buffer.deref();
        } catch {
            /* pass */
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private *processRegion(historyPoint: number, start: Vector3, end: Vector3) {
        const player = this.session.getPlayer();
        const dim = player.dimension;
        let buffer: RegionBuffer;

        try {
            const jobCtx = Jobs.getContext();
            if (!jobCtx && (!canPlaceBlock(start, dim) || !canPlaceBlock(end, dim))) {
                throw new UnloadedChunksError("worldedit.error.saveHistory");
            }

            buffer = yield* RegionBuffer.createFromWorld(start, end, dim);
            if (!buffer) throw new UnloadedChunksError("worldedit.error.saveHistory");
        } catch (err) {
            this.cancel(historyPoint);
            throw err;
        }
        return buffer!;
    }

    private assertRecording() {
        if (!this.isRecording()) {
            throw new Error("History was not being recorded!");
        }
    }

    private assertNotRecording() {
        if (this.isRecording()) {
            throw new Error("History was still being recorded!");
        }
    }
}

export interface BlockChanges {
    readonly dimension: Dimension;

    getBlockPerm(loc: Vector3): BlockPermutation;
    getBlock(loc: Vector3): BlockUnit;
    setBlock(loc: Vector3, block: BlockPermutation): void;

    applyIteration(): void;
    flush(): Generator<any>;
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
        for (const range of this.ranges) yield* this.history.addUndoStructure(this.record, ...range);

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

        for (const range of this.ranges) yield* this.history.addRedoStructure(this.record, ...range);
        this.ranges.length = 0;
        this.changes.clear();
    }

    private vec2string(vec: Vector3) {
        return "" + vec.x + "_" + vec.y + "_" + vec.z;
    }
}
