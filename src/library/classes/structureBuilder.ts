/* eslint-disable no-empty */
import { regionLoaded, regionSize, regionTransformedBounds, sleep, Vector } from "../utils/index.js";
import { Dimension, StructureMirrorAxis, StructureRotation, Vector3, world } from "@minecraft/server";

const ROT2STRUCT: { [key: number]: StructureRotation } = {
    0: StructureRotation.None,
    90: StructureRotation.Rotate90,
    180: StructureRotation.Rotate180,
    270: StructureRotation.Rotate270,
};

const FLIP2STRUCT = {
    none: StructureMirrorAxis.None,
    x: StructureMirrorAxis.X,
    z: StructureMirrorAxis.Z,
    xz: StructureMirrorAxis.XZ,
};

interface SubStructure {
    name: string;
    start: Vector;
    end: Vector;
}

interface StructureMeta {
    subRegions?: SubStructure[];
    size: Vector;
}

export interface StructureSaveOptions {
    includeEntities?: boolean;
    includeBlocks?: boolean;
    saveToDisk?: boolean;
}

export interface StructureLoadOptions {
    rotation?: number;
    flip?: "none" | "x" | "z" | "xz";
    importedSize?: Vector;
}

class StructureManager {
    private readonly MAX_SIZE: Vector = new Vector(64, 256, 64);

    private readonly structures = new Map<string, StructureMeta>();

    save(name: string, start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}) {
        const min = Vector.min(start, end);
        const max = Vector.max(start, end);
        const size = Vector.from(regionSize(start, end));
        const saveOptions = {
            includeEntities: options.includeEntities ?? false,
            includeBlocks: options.includeBlocks ?? true,
        };
        const saveToDisk = options.saveToDisk ?? false;

        if (this.beyondMaxSize(size)) {
            let error = false;
            const subStructs = this.getSubStructs(start, end);
            const saved = [];
            for (const sub of subStructs) {
                try {
                    world.structureManager.delete(name + sub.name);
                    const struct = world.structureManager.createFromWorld(name + sub.name, dim, min.add(sub.start), min.add(sub.end), saveOptions);
                    saved.push(struct);
                    if (saveToDisk) struct.saveToWorld();
                } catch {
                    error = true;
                    break;
                }
            }

            if (error) {
                saved.forEach((struct) => world.structureManager.delete(struct));
                return true;
            } else {
                this.structures.set(name, { subRegions: subStructs, size: size });
                return false;
            }
        } else {
            try {
                world.structureManager.delete(name);
                const struct = world.structureManager.createFromWorld(name, dim, min, max, saveOptions);
                if (saveToDisk) struct.saveToWorld();
                this.structures.set(name, { size });
                return false;
            } catch {
                return true;
            }
        }
    }

    async saveWhileLoadingChunks(name: string, start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}, loadArea: (min: Vector3, max: Vector3) => boolean) {
        const min = Vector.min(start, end);
        const max = Vector.max(start, end);
        const size = Vector.from(regionSize(start, end));
        const saveOptions = {
            includeEntities: options.includeEntities ?? false,
            includeBlocks: options.includeBlocks ?? true,
        };
        const saveToDisk = options.saveToDisk ?? false;

        if (this.beyondMaxSize(size)) {
            let error = false;
            const saved = [];
            const subStructs = this.getSubStructs(start, end);
            subs: for (const sub of subStructs) {
                const subStart = min.add(sub.start);
                const subEnd = min.add(sub.end);
                const subName = name + sub.name;
                world.structureManager.delete(subName);
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    try {
                        const struct = world.structureManager.createFromWorld(subName, dim, min.add(sub.start), min.add(sub.end), saveOptions);
                        saved.push(struct);
                        if (saveToDisk) struct.saveToWorld();
                        break;
                    } catch (err) {
                        if (loadArea(subStart, subEnd)) {
                            error = true;
                            break subs;
                        }
                        await sleep(1);
                    }
                }
            }

            if (error) {
                saved.forEach((struct) => world.structureManager.delete(struct));
                return true;
            } else {
                this.structures.set(name, { subRegions: subStructs, size: size });
                return false;
            }
        } else {
            world.structureManager.delete(name);
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    const struct = world.structureManager.createFromWorld(name, dim, min, max, saveOptions);
                    if (saveToDisk) struct.saveToWorld();
                    this.structures.set(name, { size });
                    return false;
                } catch (err) {
                    console.warn(err);
                    if (loadArea(min, max)) return true;
                    await sleep(1);
                }
            }
        }
    }

    load(name: string, location: Vector3, dim: Dimension, options: StructureLoadOptions = {}) {
        const loadPos = Vector.from(location);
        let rot = options.rotation ?? 0;
        rot = rot >= 0 ? rot % 360 : ((rot % 360) + 360) % 360;
        const mirror = FLIP2STRUCT[options.flip ?? "none"];
        const loadOptions = { rotation: ROT2STRUCT[rot], mirror };

        const struct = this.structures.get(name);
        if (struct?.subRegions || this.beyondMaxSize(options.importedSize ?? Vector.ZERO)) {
            const size = options.importedSize ?? struct.size;
            const rotation = new Vector(0, options.rotation ?? 0, 0);
            const dir_sc = Vector.ONE;
            if (mirror.includes("X")) dir_sc.z *= -1;
            if (mirror.includes("Z")) dir_sc.x *= -1;

            const bounds = regionTransformedBounds(Vector.ZERO, size.sub(1).floor(), Vector.ZERO, rotation, dir_sc);
            let error = false;
            const subStructs = options.importedSize ? this.getSubStructs(location, Vector.add(location, options.importedSize).floor()) : struct.subRegions;
            for (const sub of subStructs) {
                const subBounds = regionTransformedBounds(sub.start.floor(), sub.end.floor(), Vector.ZERO, rotation, dir_sc);
                try {
                    world.structureManager.place(name + sub.name, dim, Vector.sub(subBounds[0], bounds[0]).add(loadPos), loadOptions);
                } catch {
                    error = true;
                    break;
                }
            }
            return error;
        } else {
            try {
                world.structureManager.place(name, dim, loadPos, loadOptions);
                return false;
            } catch {
                return true;
            }
        }
    }

    async loadWhileLoadingChunks(name: string, location: Vector3, dim: Dimension, options: StructureLoadOptions = {}, loadArea: (min: Vector3, max: Vector3) => boolean) {
        const loadPos = Vector.from(location);
        let rot = options.rotation ?? 0;
        rot = rot >= 0 ? rot % 360 : ((rot % 360) + 360) % 360;
        const mirror = FLIP2STRUCT[options.flip ?? "none"];
        const loadOptions = { rotation: ROT2STRUCT[rot], mirror };

        const struct = this.structures.get(name);
        if (struct?.subRegions || this.beyondMaxSize(options.importedSize ?? Vector.ZERO)) {
            const size = options.importedSize ?? struct.size;
            const rotation = new Vector(0, options.rotation ?? 0, 0);
            const flip = options.flip ?? "none";
            const dir_sc = Vector.ONE;
            if (flip.includes("x")) dir_sc.z *= -1;
            if (flip.includes("z")) dir_sc.x *= -1;

            const bounds = regionTransformedBounds(Vector.ZERO, size.sub(1).floor(), Vector.ZERO, rotation, dir_sc);
            let error = false;
            const subStructs = options.importedSize ? this.getSubStructs(location, Vector.add(location, options.importedSize).floor()) : struct.subRegions;
            sub: for (const sub of subStructs) {
                const subBounds = regionTransformedBounds(sub.start.floor(), sub.end.floor(), Vector.ZERO, rotation, dir_sc);
                const subStart = Vector.sub(subBounds[0], bounds[0]).add(loadPos);
                const subEnd = Vector.sub(subBounds[1], bounds[0]).add(loadPos);
                while (!regionLoaded(subStart, subEnd, dim)) {
                    if (loadArea(subStart, subEnd)) {
                        error = true;
                        break sub;
                    }
                    await sleep(1);
                }
                try {
                    world.structureManager.place(name + sub.name, dim, subStart, loadOptions);
                } catch {
                    error = true;
                    break;
                }
            }
            return error;
        } else {
            while (!regionLoaded(loadPos, loadPos.add(struct.size).sub(1), dim)) {
                if (loadArea(loadPos, loadPos.add(struct.size).sub(1))) return true;
                await sleep(1);
            }
            try {
                world.structureManager.place(name, dim, loadPos, loadOptions);
                return false;
            } catch {
                return true;
            }
        }
    }

    has(name: string) {
        return this.structures.has(name);
    }

    delete(name: string) {
        const struct = this.structures.get(name);
        if (struct) {
            if (struct.subRegions) {
                for (const sub of struct.subRegions) world.structureManager.delete(`${name}${sub.name}`);
            } else {
                world.structureManager.delete(name);
            }
            this.structures.delete(name);
            return false;
        }
        return true;
    }

    getSize(name: string) {
        return this.structures.get(name).size.floor();
    }

    private beyondMaxSize(size: Vector3) {
        return size.x > this.MAX_SIZE.x || size.y > this.MAX_SIZE.y || size.z > this.MAX_SIZE.z;
    }

    private getSubStructs(start: Vector3, end: Vector3) {
        const size = regionSize(start, end);
        const subStructs: SubStructure[] = [];
        for (let z = 0; z < size.z; z += this.MAX_SIZE.z)
            for (let y = 0; y < size.y; y += this.MAX_SIZE.y)
                for (let x = 0; x < size.x; x += this.MAX_SIZE.x) {
                    const subStart = new Vector(x, y, z);
                    const subEnd = Vector.min(subStart.add(this.MAX_SIZE).sub(1), size.add([-1, -1, -1]));
                    const subName = `_${x / this.MAX_SIZE.x}_${y / this.MAX_SIZE.y}_${z / this.MAX_SIZE.z}`;

                    subStructs.push({
                        name: subName,
                        start: subStart,
                        end: subEnd,
                    });
                }
        return subStructs;
    }
}

export const Structure = new StructureManager();
