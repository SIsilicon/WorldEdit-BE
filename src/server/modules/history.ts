import { BlockLocation } from "@minecraft/server";
import { Vector, regionVolume, Server } from "@notbeer-api";
import { assertCanBuildWithin } from "./assert.js";
import { canPlaceBlock } from "../util.js";
import { PlayerSession } from "../sessions.js";
import { selectMode } from "./selection.js";
import config from "config.js";

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
    selection: [selectionEntry, selectionEntry] | selectionEntry | "none";

    blocksChanged: number;
    brush: boolean;
};

let historyId = 0;
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
    const historyPoint = {
      undo: [] as historyEntry[],
      redo: [] as historyEntry[],
      selection: "none",

      blocksChanged: 0,
      brush
    } as historyPoint;
    this.historyPoints.set(++historyPointId, historyPoint);
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

    for (const struct of point.undo) {
      Server.structure.delete(struct.name);
    }
    for (const struct of point.redo) {
      Server.structure.delete(struct.name);
    }
  }

  async addUndoStructure(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | "any" = "any") {
    // contentLog.debug("adding undo structure");
    const point = this.historyPoints.get(historyPoint);
    point.blocksChanged += blocks == "any" ? regionVolume(start, end) : blocks.length;
    // We test the change limit here,
    if (point.blocksChanged > this.session.changeLimit) {
      throw "commands.generic.wedit:blockLimit";
    }

    const structName = await this.processRegion(historyPoint, start, end, blocks);
    point.undo.push({
      "name": structName,
      "location": Vector.min(start, end).toBlock()
    });
    // contentLog.debug("added undo structure");
  }

  async addRedoStructure(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | "any" = "any") {
    const point = this.historyPoints.get(historyPoint);
    this.assertRecording();

    const structName = await this.processRegion(historyPoint, start, end, blocks);
    point.redo.push({
      "name": structName,
      "location": Vector.min(start, end).toBlock()
    });
  }

  recordSelection(historyPoint: number, session: PlayerSession) {
    const point = this.historyPoints.get(historyPoint);
    if (point.selection == "none") {
      point.selection = {
        type: session.selection.mode,
        points: session.selection.points
      };
    } else if ("points" in point.selection) {
      point.selection = [
        point.selection,
        {
          type: session.selection.mode,
          points: session.selection.points
        }
      ];
    } else {
      throw new Error("Cannot call \"recordSelection\" more than two times!");
    }
  }

  async undo(session: PlayerSession) {
    this.assertNotRecording();
    if (this.historyIdx <= -1) {
      return true;
    }

    const player = this.session.getPlayer();
    const dim = player.dimension;
    for (const region of this.undoStructures[this.historyIdx]) {
      const pos = region.location;
      const size = Server.structure.getSize(region.name);
      assertCanBuildWithin(player, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
    }

    for (const region of this.undoStructures[this.historyIdx]) {
      await Server.structure.load(region.name, region.location, dim);
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

  async redo(session: PlayerSession) {
    this.assertNotRecording();
    if (this.historyIdx >= this.redoStructures.length - 1) {
      return true;
    }

    const player = this.session.getPlayer();
    const dim = player.dimension;
    for (const region of this.redoStructures[this.historyIdx + 1]) {
      const pos = region.location;
      const size = Server.structure.getSize(region.name);
      assertCanBuildWithin(player, pos, Vector.from(pos).add(size).sub(Vector.ONE).toBlock());
    }

    this.historyIdx++;
    for (const region of this.redoStructures[this.historyIdx]) {
      await Server.structure.load(region.name, region.location, dim);
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

  delete() {
    while (this.undoStructures.length) {
      this.deleteHistoryRegions(0);
    }
  }

  private deleteHistoryRegions(index: number) {
    for (const struct of this.undoStructures[index]) {
      Server.structure.delete(struct.name);
    }
    for (const struct of this.redoStructures[index]) {
      Server.structure.delete(struct.name);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async processRegion(historyPoint: number, start: BlockLocation, end: BlockLocation, blocks: BlockLocation[] | "any") {
    let structName: string;
    const player = this.session.getPlayer();
    const dim = player.dimension;

    const finish = () => {
      // if (recordBlocks) {
      //   Server.structure.load(tempRegion, loc, dim);
      //   Server.structure.delete(tempRegion);
      // }
      return;
    };

    try {
      if (!canPlaceBlock(start, dim) || !canPlaceBlock(end, dim)) {
        throw new Error("Failed to save history!");
      }

      // TODO: Get history precise recording working again
      // Assuming that `blocks` was made with `start.blocksBetween(end)` and then filtered.
      // if (recordBlocks) {
      //   loc = Vector.min(start, end).toBlock();
      //   const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
      //   Server.structure.save(tempRegion, start, end, dim);
      //   let index = 0;
      //   for (const block of start.blocksBetween(end)) {
      //     if (blocks[index]?.equals(block)) {
      //       index++;
      //     } else {
      //       dim.getBlock(block).setPermutation(voidBlock);
      //     }
      //   }
      // }

      structName = "wedit:history_" + (historyId++).toString(16);
      if (await Server.structure.save(structName, start, end, dim)) {
        finish();
        this.cancel(historyPoint);
        throw new Error("Failed to save history!");
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
      throw new Error("History was not being recorded!");
    }
  }

  private assertNotRecording() {
    if (this.isRecording()) {
      throw new Error("History was still being recorded!");
    }
  }
}
