import { contentLog, generateId, regionSize, Server, StructureLoadOptions, StructureSaveOptions } from "@notbeer-api";
import { BlockLocation, BlockPermutation, Dimension, Vector } from "mojang-minecraft";

// TODO: Record entities
export class RegionBuffer {

    readonly isAccurate: boolean;
    readonly id: string;

    private size: BlockLocation;
    private blocks = new Map<number, Map<number, Map<number, BlockPermutation|string>>>();

    constructor(isAccurate = false) {
        this.isAccurate = isAccurate && false;
        this.id = 'wedit:buffer_' + generateId();
        contentLog.debug('creating structure', this.id);
    }

    save(start: BlockLocation, end: BlockLocation, dim: Dimension, options: StructureSaveOptions = {}, blocks: BlockLocation[] = []) {
        if (this.isAccurate) {
            
        } else {
            if (Server.structure.save(this.id, start, end, dim, options)) {
                return true;
            }
        }
        this.size = regionSize(start, end);
        return false;
    }

    load(loc: BlockLocation, dim: Dimension, options: StructureLoadOptions = {}) {
        if (this.isAccurate) {

        } else {
            return Server.structure.load(this.id, loc, dim, options);
        }
    }

    // TODO: support accurate
    getSize() {
        return this.size;
    }

    getBlockCount() {
        return this.size.x * this.size.y * this.size.z;
    }

    getBlock() {

    }

    setBlock() {

    }

    delete() {
        Server.structure.delete(this.id);
        contentLog.debug('deleting structure', this.id);
    }
}