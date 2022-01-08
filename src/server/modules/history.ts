import { BlockLocation, MinecraftBlockTypes, Player } from 'mojang-minecraft';
import { Regions } from './regions.js';
import { assertCanBuildWithin } from './assert.js';
import { canPlaceBlock, printDebug } from '../util.js';
import { PlayerSession, selectMode } from '../sessions.js';
import { Vector } from './vector.js';
import { PlayerUtil } from './player_util.js';
import { MAX_HISTORY_SIZE, HISTORY_MODE, BRUSH_HISTORY_MODE } from '@config.js';

type historyEntry = {
    name: string,
    location: BlockLocation
};

type selectionEntry = {
    type: selectMode,
    points: BlockLocation[]
};

let historyId = Date.now();

export class History {
    private recording = false;
    private recordingBrush = false;

    private recordingUndo: historyEntry[];
    private recordingRedo: historyEntry[];
    private recordingSelection: [selectionEntry, selectionEntry] | selectionEntry | 'none';
    
    private undoStructures: historyEntry[][] = [];
    private redoStructures: historyEntry[][] = [];
    private selectionHistory: (typeof this.recordingSelection)[] = [];
    private historyIdx = -1;
    
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    reassignPlayer(player: Player) {
        this.player = player;
    }

    record(brush = false) {
        this.assertNotRecording();
        this.recording = true;
        this.recordingBrush = brush;

        this.recordingUndo = [];
        this.recordingRedo = [];
        this.recordingSelection = 'none';
    }

    commit() {
        this.assertRecording();
        this.recording = false;
        if (this.recordingBrush && !BRUSH_HISTORY_MODE || !this.recordingBrush && !HISTORY_MODE) {
            return;
        }

        this.historyIdx++;
        for (let i = this.historyIdx; i < this.undoStructures.length; i++) {
            this.deleteHistoryRegions(i);
        }
        this.undoStructures.length = this.redoStructures.length = this.selectionHistory.length = this.historyIdx + 1;
        
        this.undoStructures[this.historyIdx] = this.recordingUndo;
        this.redoStructures[this.historyIdx] = this.recordingRedo;
        this.selectionHistory[this.historyIdx] = this.recordingSelection;
        
        while (this.historyIdx > MAX_HISTORY_SIZE - 1) {
            this.deleteHistoryRegions(0);
            this.undoStructures.shift();
            this.redoStructures.shift();
            this.selectionHistory.shift();
            this.historyIdx--;
        }
    }

    cancel() {
        this.assertRecording();
        this.recording = false;

        for (const struct of this.recordingUndo) {
            Regions.delete(struct.name, this.player);
        }
        for (const struct of this.recordingRedo) {
            Regions.delete(struct.name, this.player);
        }
    }

    addUndoStructure(start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any' = 'any') {
        this.assertRecording();
        if (this.recordingBrush && !BRUSH_HISTORY_MODE || !this.recordingBrush && !HISTORY_MODE) {
            return;
        }
        
        const structName = this.processRegion(start, end, blocks);
        this.recordingUndo.push({
            'name': structName,
            'location': Vector.min(start, end).toBlock()
        })
    }

    addRedoStructure(start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any' = 'any') {
        this.assertRecording();
        if (this.recordingBrush && !BRUSH_HISTORY_MODE || !this.recordingBrush && !HISTORY_MODE) {
            return;
        }
        
        const structName = this.processRegion(start, end, blocks);
        this.recordingRedo.push({
            'name': structName,
            'location': Vector.min(start, end).toBlock()
        })
    }
    
    recordSelection(session: PlayerSession) {
        this.assertRecording();
        if (this.recordingSelection == 'none') { 
            this.recordingSelection = {
                type: session.selectionMode,
                points: session.getSelectionPoints()
            }
        } else if ('points' in this.recordingSelection) {
            this.recordingSelection = [
                this.recordingSelection,
                {
                    type: session.selectionMode,
                    points: session.getSelectionPoints()
                }
            ]
        } else {
            throw 'Cannot call "recordSelection" more than two times!';
        }
    }
    
    undo(session: PlayerSession) {
        this.assertNotRecording();
        if (this.historyIdx <= -1) {
            return true;
        }
        
        const dim = PlayerUtil.getDimension(this.player)[1];
        for (const region of this.undoStructures[this.historyIdx]) {
            const pos = region.location;
            const size = Regions.getSize(region.name, this.player);
            assertCanBuildWithin(dim, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
        }
        
        for (const region of this.undoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, this.player);
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
        
        const dim = PlayerUtil.getDimension(this.player)[1];
        for (const region of this.redoStructures[this.historyIdx+1]) {
            const pos = region.location;
            const size = Regions.getSize(region.name, this.player);
            assertCanBuildWithin(dim, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
        }
        
        this.historyIdx++;
        for (const region of this.redoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, this.player);
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
        return this.recording;
    }
    
    private deleteHistoryRegions(index: number) {
        for (const struct of this.undoStructures[index]) {
            Regions.delete(struct.name, this.player);
        }
        for (const struct of this.redoStructures[index]) {
            Regions.delete(struct.name, this.player);
        }
    }

    private processRegion(start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | 'any') {
        const tempRegion = 'tempHistoryVoid';
        let structName: string;
        const recordBlocks = Array.isArray(blocks) && (this.recordingBrush && BRUSH_HISTORY_MODE == 2 || !this.recordingBrush && HISTORY_MODE == 2);
        const dim = PlayerUtil.getDimension(this.player)[1];
        
        const finish = () => {
            if (recordBlocks) {
                Regions.load(tempRegion, loc, this.player);
                Regions.delete(tempRegion, this.player);
            }
        }

        try {
            if (!canPlaceBlock(start, dim) || !canPlaceBlock(end, dim)) {
                throw 'Failed to save history!';
            }

            // Assuming that `blocks` was made with `start.blocksBetween(end)` and then filtered.
            if (recordBlocks) {
                var loc = Vector.min(start, end).toBlock();
                const dimension = PlayerUtil.getDimension(this.player)[0];
                const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
                Regions.save(tempRegion, start, end, this.player);
                let index = 0;
                for (const block of start.blocksBetween(end)) {
                    if (blocks[index]?.equals(block)) {
                        index++;
                    } else {
                        dimension.getBlock(block).setPermutation(voidBlock);
                    }
                }
            }

            structName = 'history' + historyId++;
            if (Regions.save(structName, start, end, this.player)) {
                finish();
                this.cancel();
                throw 'Failed to save history!';
            }
        } catch (err) {
            finish();
            this.cancel();
            throw err;
        }

        finish();
        return structName;
    }

    private assertRecording() {
        if (!this.recording) {
            throw 'History was not being recorded!';
        }
    }

    private assertNotRecording() {
        if (this.recording) {
            throw 'History was still being recorded!';
        }
    }

}
