import { Vector3, Dimension, Player } from "@minecraft/server";
import { Vector, regionVolume, regionSize, Thread, getCurrentThread, VectorSet } from "@notbeer-api";
import { UnloadedChunksError } from "./assert.js";
import { canPlaceBlock } from "../util.js";
import { PlayerSession } from "../sessions.js";
import { Selection, selectMode } from "./selection.js";
import config from "config.js";
import { Jobs } from "./jobs.js";
import { RegionBuffer } from "./region_buffer.js";

interface historyEntry {
    buffer: RegionBuffer;
    dimension: Dimension;
    location: Vector3;
    size: Vector3;
}

interface selectionEntry {
    type: selectMode;
    points: Vector[];
}

interface historyPoint {
    undo: historyEntry[];
    redo: historyEntry[];
    selection?: [selectionEntry, selectionEntry] | selectionEntry;

    blocksChanged: number;
    thread: Thread;
}

let historyPointId = 0;

export abstract class History {
    protected readonly player: Player;
    protected readonly changeLimit: number;
    protected readonly selection: Selection;

    constructor(session: PlayerSession) {
        this.player = session.player;
        this.changeLimit = session.changeLimit;
        this.selection = session.selection;
    }

    abstract record(): number;

    abstract commit(historyPoint: number): Generator<any, void>;

    abstract cancel(historyPoint: number): void;

    abstract trackRegion(historyPoint: number, start: Vector3, end: Vector3): Generator<any, void>;
    abstract trackRegion(historyPoint: number, blocks: Vector3[] | VectorSet): Generator<any, void>;
    abstract trackSelection(historyPoint: number): void;

    abstract undo(): Generator<any, boolean>;

    abstract redo(): Generator<any, boolean>;

    abstract clear(): void;

    abstract isRecording(): boolean;

    abstract getActivePointsInThread(thread: Thread): number[];

    protected assertRecording() {
        if (!this.isRecording()) throw new Error("History was not being recorded!");
    }

    protected assertNotRecording() {
        if (this.isRecording()) throw new Error("History was still being recorded!");
    }
}

class DefaultHistory extends History {
    private historyPoints = new Map<number, historyPoint>();

    private undoStructures: historyEntry[][] = [];
    private redoStructures: historyEntry[][] = [];
    private selectionHistory: historyPoint["selection"][] = [];
    private historyIdx = -1;

    record() {
        historyPointId++;
        const historyPoint = {
            undo: [] as historyEntry[],
            redo: [] as historyEntry[],

            blocksChanged: 0,
            thread: getCurrentThread(),
        } as historyPoint;
        this.historyPoints.set(historyPointId, historyPoint);
        return historyPointId;
    }

    *commit(historyPoint: number) {
        const point = this.historyPoints.get(historyPoint);
        if (point) {
            for (const undo of point.undo) {
                const start = undo.location;
                const end = Vector.add(undo.location, undo.size).sub(1);
                const buffer = yield* this.processRegion(historyPoint, start, end);
                point.redo.push({
                    buffer,
                    dimension: this.player.dimension,
                    location: Vector.min(start, end).floor(),
                    size: regionSize(start, end),
                });
            }
            if (point.selection) point.selection = [<selectionEntry>point.selection, { type: this.selection.mode, points: this.selection.points }];
        }

        this.historyPoints.delete(historyPoint);

        this.historyIdx++;
        for (let i = this.historyIdx; i < this.undoStructures.length; i++) this.deleteHistoryRegions(i);
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

    *trackRegion(historyPoint: number, startBlocks: Vector3 | Vector3[] | VectorSet, end?: Vector3) {
        // contentLog.debug("adding undo structure");
        const point = this.historyPoints.get(historyPoint);
        point.blocksChanged += "x" in startBlocks ? regionVolume(startBlocks, end) : Array.isArray(startBlocks) ? startBlocks.length : startBlocks.size;
        // We test the change limit here,
        if (point.blocksChanged > this.changeLimit) throw "commands.generic.wedit:blockLimit";

        const start = "x" in startBlocks ? startBlocks : (Array.isArray(startBlocks) ? startBlocks : Array.from(startBlocks)).reduce((a, b) => Vector.min(a, b));
        const buffer = yield* this.processRegion(historyPoint, start, end);
        point.undo.push({
            buffer,
            dimension: this.player.dimension,
            location: Vector.min(start, end).floor(),
            size: regionSize(start, end),
        });
    }

    trackSelection(historyPoint: number) {
        const point = this.historyPoints.get(historyPoint);
        if (!point.selection) point.selection = { type: this.selection.mode, points: this.selection.points };
        else throw new Error('Cannot call "recordSelection" more than once!');
    }

    *undo() {
        this.assertNotRecording();
        if (this.historyIdx <= -1) return true;

        const player = this.player;
        const dim = player.dimension;
        for (const region of this.undoStructures[this.historyIdx]) yield* region.buffer.load(region.location, dim);

        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) selection = (<[selectionEntry, selectionEntry]>this.selectionHistory[this.historyIdx])[0];
        else selection = <selectionEntry>this.selectionHistory[this.historyIdx];

        if (selection) {
            this.selection.mode = selection.type;
            for (let i = 0; i < selection.points.length; i++) this.selection.set(i == 0 ? 0 : 1, selection.points[i]);
        }
        this.historyIdx--;

        return false;
    }

    *redo() {
        this.assertNotRecording();
        if (this.historyIdx >= this.redoStructures.length - 1) return true;

        const player = this.player;
        const dim = player.dimension;
        this.historyIdx++;
        for (const region of this.redoStructures[this.historyIdx]) {
            yield* region.buffer.load(region.location, dim);
        }

        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) selection = (<[selectionEntry, selectionEntry]>this.selectionHistory[this.historyIdx])[1];
        else selection = <selectionEntry>this.selectionHistory[this.historyIdx];

        if (selection) {
            this.selection.mode = selection.type;
            for (let i = 0; i < selection.points.length; i++) this.selection.set(i == 0 ? 0 : 1, selection.points[i]);
        }

        return false;
    }

    clear() {
        this.historyIdx = -1;
        for (let i = 0; i < this.undoStructures.length; i++) this.deleteHistoryRegions(i);
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
        const player = this.player;
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
}

let historyClass: { new (session: PlayerSession): History } = DefaultHistory;

export function createHistoryBufferForSession(session: PlayerSession) {
    return new historyClass(session);
}

export function setHistoryClass(newHistoryClass: { new (session: PlayerSession): History }) {
    historyClass = newHistoryClass;
}
