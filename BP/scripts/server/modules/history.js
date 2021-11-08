import { MinecraftBlockTypes } from 'mojang-minecraft';
import { Regions } from './regions.js';
import { canPlaceBlock, getPlayerDimension, regionMin } from '../util.js';
import { MAX_HISTORY_SIZE, HISTORY_MODE, BRUSH_HISTORY_MODE } from '../../config.js';
let historyId = Date.now();
export class History {
    constructor(player) {
        this.recording = false;
        this.recordingBrush = false;
        this.undoStructures = [];
        this.redoStructures = [];
        this.historyIdx = -1;
        this.player = player;
    }
    reassignPlayer(player) {
        this.player = player;
    }
    record(brush = false) {
        this.assertNotRecording();
        this.recording = true;
        this.recordingBrush = brush;
        this.recordingUndo = [];
        this.recordingRedo = [];
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
        this.undoStructures.length = this.historyIdx + 1;
        this.redoStructures.length = this.historyIdx + 1;
        this.undoStructures[this.historyIdx] = this.recordingUndo;
        this.redoStructures[this.historyIdx] = this.recordingRedo;
        while (this.historyIdx > MAX_HISTORY_SIZE - 1) {
            this.deleteHistoryRegions(0);
            this.undoStructures.shift();
            this.redoStructures.shift();
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
    addUndoStructure(start, end, blocks = 'any') {
        this.assertRecording();
        if (this.recordingBrush && !BRUSH_HISTORY_MODE || !this.recordingBrush && !HISTORY_MODE) {
            return;
        }
        const structName = this.processRegion(start, end, blocks);
        this.recordingUndo.push({
            'name': structName,
            'location': regionMin(start, end)
        });
    }
    addRedoStructure(start, end, blocks = 'any') {
        this.assertRecording();
        if (this.recordingBrush && !BRUSH_HISTORY_MODE || !this.recordingBrush && !HISTORY_MODE) {
            return;
        }
        const structName = this.processRegion(start, end, blocks);
        this.recordingRedo.push({
            'name': structName,
            'location': regionMin(start, end)
        });
    }
    undo() {
        this.assertNotRecording();
        if (this.historyIdx <= -1) {
            return true;
        }
        for (const region of this.undoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, this.player, 'absolute');
        }
        ;
        this.historyIdx--;
        return false;
    }
    redo() {
        this.assertNotRecording();
        if (this.historyIdx >= this.redoStructures.length - 1) {
            return true;
        }
        this.historyIdx++;
        for (const region of this.redoStructures[this.historyIdx]) {
            Regions.load(region.name, region.location, this.player, 'absolute');
        }
        ;
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
    deleteHistoryRegions(index) {
        for (const struct of this.undoStructures[index]) {
            Regions.delete(struct.name, this.player);
        }
        for (const struct of this.redoStructures[index]) {
            Regions.delete(struct.name, this.player);
        }
    }
    processRegion(start, end, blocks) {
        const tempRegion = 'tempHistoryVoid';
        let structName;
        const recordBlocks = Array.isArray(blocks) && (this.recordingBrush && BRUSH_HISTORY_MODE == 2 || !this.recordingBrush && HISTORY_MODE == 2);
        const finish = () => {
            if (recordBlocks) {
                Regions.load(tempRegion, loc, this.player, 'absolute');
                Regions.delete(tempRegion, this.player);
            }
        };
        try {
            if (!canPlaceBlock(start) || !canPlaceBlock(end)) {
                throw 'Failed to save history!';
            }
            // Assuming that `blocks` was made with `start.blocksBetween(end)` and then filtered.
            if (recordBlocks) {
                var loc = regionMin(start, end);
                const dimension = getPlayerDimension(this.player)[0];
                const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
                Regions.save(tempRegion, start, end, this.player);
                let index = 0;
                for (const block of start.blocksBetween(end)) {
                    if (blocks[index]?.equals(block)) {
                        index++;
                    }
                    else {
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
        }
        catch (err) {
            finish();
            this.cancel();
            throw err;
        }
        finish();
        return structName;
    }
    assertRecording() {
        if (!this.recording) {
            throw 'History was not being recorded!';
        }
    }
    assertNotRecording() {
        if (this.recording) {
            throw 'History was still being recorded!';
        }
    }
}
