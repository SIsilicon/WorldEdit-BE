import { BlockLocation, MinecraftBlockTypes, Player } from 'mojang-minecraft';
import { Regions } from './regions.js';
import { assertCanBuildWithin } from './assert.js';
import { canPlaceBlock, regionVolume } from '../util.js';
import { PlayerSession, selectMode } from '../sessions.js';
import { Vector } from '@notbeer-api';
import { MAX_HISTORY_SIZE, HISTORY_MODE, BRUSH_HISTORY_MODE } from '@config.js';

type historyEntry = {
    name: string,
    location: BlockLocation
};

type selectionEntry = {
    type: selectMode,
    points: BlockLocation[]
};

type historyPoint = {
    undo: historyEntry[];
    redo: historyEntry[];
    selection: [selectionEntry, selectionEntry] | selectionEntry | 'none';
    
    blocksChanged: number;
    brush: boolean;
};

let historyId = Date.now();
let historyPointId = 0;

export class History {
    private historyPoints = new Map<number, historyPoint>();

    private undoStructures: historyEntry[][] = [];
    private redoStructures: historyEntry[][] = [];
    private selectionHistory: historyPoint['selection'][] = [];
    private historyIdx = -1;
    
    private session: PlayerSession;

    constructor(session: PlayerSession) {
        this.session = session;
    }

    record(brush = false) {
        let historyPoint = {
            undo: [] as historyEntry[],
            redo: [] as historyEntry[],
            selection: 'none',
            
            blocksChanged: 0,
            brush: brush
        } as historyPoint;
        this.historyPoints.set(++historyPointId, historyPoint);
        return historyPointId;
    }

    commit(historyPoint: number) {
        const point = this.historyPoints.get(historyPoint);
        this.historyPoints.delete(historyPoint);
        if (point.brush && !BRUSH_HISTORY_MODE || !point.brush && !HISTORY_MODE) {
            return;
        }

        this.historyIdx++;
        for (let i = this.historyIdx; i < this.undoStructures.length; i++) {
            this.deleteHistoryRegions(i);
        }
        this.undoStructures.length = this.redoStructures.length = this.selectionHistory.length = this.historyIdx + 1;
        
        this.undoStructures[this.historyIdx] = point.undo;
        this.redoStructures[this.historyIdx] = point.redo;
        this.selectionHistory[this.historyIdx] = point.selection;
        
        while (this.historyIdx > MAX_HISTORY_SIZE - 1) {
            this.deleteHistoryRegions(0);
            this.undoStructures.shift();
            this.redoStructures.shift();
            this.selectionHistory.shift();
            this.historyIdx--;
        }
    }

    cancel(historyPoint: number) {
        const point = this.historyPoints.get(historyPoint);
        this.historyPoints.delete(historyPoint);

        const player = this.session.getPlayer();
        for (const struct of point.undo) {
            Regions.delete(struct.name, player);
        }
        for (const struct of point.redo) {
            Regions.delete(struct.name, player);
        }
    }

    addUndoStructure(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any' = 'any') {
        const point = this.historyPoints.get(historyPoint);
        point.blocksChanged += regionVolume(start, end);
        // We test the change limit here,
        if (point.blocksChanged > this.session.changeLimit) {
            throw 'commands.generic.wedit:blockLimit';
        }
        
        if (point.brush && !BRUSH_HISTORY_MODE || !point.brush && !HISTORY_MODE) {
            return;
        }
        
        const structName = this.processRegion(historyPoint, start, end, blocks);
        point.undo.push({
            'name': structName,
            'location': Vector.min(start, end).toBlock()
        })
    }

    addRedoStructure(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any' = 'any') {
        const point = this.historyPoints.get(historyPoint);
        this.assertRecording();
        if (point.brush && !BRUSH_HISTORY_MODE || !point.brush && !HISTORY_MODE) {
            return;
        }
        
        const structName = this.processRegion(historyPoint, start, end, blocks);
        point.redo.push({
            'name': structName,
            'location': Vector.min(start, end).toBlock()
        })
    }
    
    recordSelection(historyPoint: number, session: PlayerSession) {
        const point = this.historyPoints.get(historyPoint);
        if (point.selection == 'none') { 
            point.selection = {
                type: session.selectionMode,
                points: session.getSelectionPoints()
            }
        } else if ('points' in point.selection) {
            point.selection = [
                point.selection,
                {
                    type: session.selectionMode,
                    points: session.getSelectionPoints()
                }
            ]
        } else {
            throw new Error('Cannot call "recordSelection" more than two times!');
        }
    }
    
    undo(session: PlayerSession) {
        this.assertNotRecording();
        if (this.historyIdx <= -1) {
            return true;
        }
        
        const player = this.session.getPlayer();
        const dim = player.dimension;
        for (const region of this.undoStructures[this.historyIdx]) {
            const pos = region.location;
            const size = Regions.getSize(region.name, player);
            assertCanBuildWithin(dim, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
        }
        
        for (const region of this.undoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, player);
        }
        
        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) {
            selection = (<[selectionEntry, selectionEntry]> this.selectionHistory[this.historyIdx])[0];
        } else if (this.selectionHistory[this.historyIdx] != 'none') {
            selection = <selectionEntry> this.selectionHistory[this.historyIdx];
        }
        if (selection) {
            session.selectionMode = selection.type;
            for (let i = 0; i < selection.points.length; i++) {
                session.setSelectionPoint(i == 0 ? 0 : 1, selection.points[i]);
            }
        }
        this.historyIdx--;

        return false;
    }

    redo(session: PlayerSession) {
        this.assertNotRecording();
        if (this.historyIdx >= this.redoStructures.length - 1) {
            return true;
        }
        
        const player = this.session.getPlayer();
        const dim = player.dimension;
        for (const region of this.redoStructures[this.historyIdx+1]) {
            const pos = region.location;
            const size = Regions.getSize(region.name, player);
            assertCanBuildWithin(dim, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
        }
        
        this.historyIdx++;
        for (const region of this.redoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, player);
        }
        
        let selection: selectionEntry;
        if (Array.isArray(this.selectionHistory[this.historyIdx])) {
            selection = (<[selectionEntry, selectionEntry]> this.selectionHistory[this.historyIdx])[1];
        } else if (this.selectionHistory[this.historyIdx] != 'none') {
            selection = <selectionEntry> this.selectionHistory[this.historyIdx];
        }
        if (selection) {
            session.selectionMode = selection.type;
            for (let i = 0; i < selection.points.length; i++) {
                session.setSelectionPoint(i == 0 ? 0 : 1, selection.points[i]);
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
    
    private deleteHistoryRegions(index: number) {
        const player = this.session.getPlayer();
        for (const struct of this.undoStructures[index]) {
            Regions.delete(struct.name, player);
        }
        for (const struct of this.redoStructures[index]) {
            Regions.delete(struct.name, player);
        }
    }

    private processRegion(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any') {
        const tempRegion = 'tempHistoryVoid';
        const point = this.historyPoints.get(historyPoint);
        let structName: string;
        const recordBlocks = Array.isArray(blocks) && (point.brush && BRUSH_HISTORY_MODE == 2 || !point.brush && HISTORY_MODE == 2);
        const player = this.session.getPlayer();
        const dim = player.dimension;
        
        const finish = () => {
            if (recordBlocks) {
                Regions.load(tempRegion, loc, player);
                Regions.delete(tempRegion, player);
            }
        }

        try {
            if (!canPlaceBlock(start, dim) || !canPlaceBlock(end, dim)) {
                throw new Error('Failed to save history!');
            }

            // Assuming that `blocks` was made with `start.blocksBetween(end)` and then filtered.
            if (recordBlocks) {
                var loc = Vector.min(start, end).toBlock();
                const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
                Regions.save(tempRegion, start, end, player);
                let index = 0;
                for (const block of start.blocksBetween(end)) {
                    if (blocks[index]?.equals(block)) {
                        index++;
                    } else {
                        dim.getBlock(block).setPermutation(voidBlock);
                    }
                }
            }

            structName = 'history' + historyId++;
            if (Regions.save(structName, start, end, player)) {
                finish();
                this.cancel(historyPoint);
                throw new Error('Failed to save history!');
            }
        } catch (err) {
            finish();
            this.cancel(historyPoint);
            throw err;
        }

        finish();
        return structName;
    }

    private assertRecording() {
        if (!this.isRecording()) {
            throw new Error('History was not being recorded!');
        }
    }

    private assertNotRecording() {
        if (this.isRecording()) {
            throw new Error('History was still being recorded!');
        }
    }
}
