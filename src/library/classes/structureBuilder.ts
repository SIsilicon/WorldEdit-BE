/* eslint-disable no-empty */
import { regionSize, regionTransformedBounds, Vector } from "../utils/index.js";
import { Dimension, Vector3, world } from "@minecraft/server";
import { Server } from "@notbeer-api";

interface SubStructure {
  name: string,
  start: Vector,
  end: Vector
}

interface StructureMeta {
  subRegions?: SubStructure[],
  size: Vector
}

export interface StructureSaveOptions {
  includeEntities?: boolean,
  includeBlocks?: boolean,
  saveToDisk?: boolean
}

export interface StructureLoadOptions {
  rotation?: number,
  flip?: "none"|"x"|"z"|"xz",
  importedSize?: Vector
}

class StructureManager {
  private readonly MAX_SIZE: Vector = new Vector(64, 256, 64);

  private readonly structures = new Map<string, StructureMeta>();

  save(name: string, start: Vector3, end: Vector3, dim: Dimension, options: StructureSaveOptions = {}) {
    const min = Vector.min(start, end);
    const max = Vector.max(start, end);
    const size = Vector.from(regionSize(start, end));

    const includeEntities = options.includeEntities ?? false;
    const includeBlocks = options.includeBlocks ?? true;
    const saveTo = (options.saveToDisk ?? false) ? "disk" : "memory";

    if (this.beyondMaxSize(size)) {
      const promises = [];
      const subStructs = this.getSubStructs(start, end);
      for (const sub of subStructs) {
        const subStart = min.add(sub.start);
        const subEnd = min.add(sub.end);
        const subName = name + sub.name;
        promises.push(Server.runCommand(`structure save ${subName} ${subStart.print()} ${subEnd.print()} ${includeEntities} ${saveTo} ${includeBlocks}`, dim));
      }

      return Promise.all(promises).then(result => {
        if (result.some(res => res.error)) {
          for (const sub of subStructs) {
            Server.runCommand(`structure delete ${name + sub.name}`, dim);
          }
          return true;
        } else {
          this.structures.set(name, {
            subRegions: subStructs,
            size: size
          });
          return false;
        }
      });
    } else {
      const startStr = min.print();
      const endStr = max.print();

      return Server.runCommand(`structure save ${name} ${startStr} ${endStr} ${includeEntities} ${saveTo} ${includeBlocks}`, dim).then(result => {
        if (result.error) {
          return true;
        }
        this.structures.set(name, {
          size: size
        });
        return false;
      });
    }
  }

  load(name: string, location: Vector3, dim: Dimension, options: StructureLoadOptions = {}) {
    const loadPos = Vector.from(location);
    let rot = (options.rotation ?? 0);
    rot = rot >= 0 ? rot % 360 : (rot % 360 + 360) % 360;
    const flip = options.flip ?? "none";

    const struct = this.structures.get(name);
    if (struct?.subRegions || this.beyondMaxSize(options.importedSize ?? Vector.ZERO)) {
      const size = options.importedSize ?? struct.size;
      const rotation = new Vector(0, options.rotation ?? 0, 0);
      const flip = options.flip ?? "none";
      const dir_sc = Vector.ONE;
      if (flip.includes("x")) dir_sc.z *= -1;
      if (flip.includes("z")) dir_sc.x *= -1;

      const bounds = regionTransformedBounds(Vector.ZERO, size.sub(1).floor(), Vector.ZERO, rotation, dir_sc);
      const promises = [];
      const subStructs = options.importedSize ?
        this.getSubStructs(location, Vector.add(location, options.importedSize).floor()) :
        struct.subRegions;
      for (const sub of subStructs) {
        const subBounds = regionTransformedBounds(sub.start.floor(), sub.end.floor(), Vector.ZERO, rotation, dir_sc);
        const subLoad = Vector.sub(subBounds[0], bounds[0]).add(loadPos);
        promises.push(Server.runCommand(`structure load ${name + sub.name} ${subLoad.print()} ${rot}_degrees ${flip}`, dim));
      }
      return Promise.all(promises).then(result => result.some(res => res.error));
    } else {
      return Server.runCommand(`structure load ${name} ${loadPos.print()} ${rot}_degrees ${flip}`, dim).then(result => result.error);
    }
  }

  has(name: string) {
    return this.structures.has(name);
  }

  delete(name: string) {
    const struct = this.structures.get(name);
    const dim = world.getDimension("overworld");
    if (struct) {
      if (struct.subRegions) {
        const promises = [];
        for (const sub of struct.subRegions) {
          promises.push(Server.runCommand(`structure delete ${name}${sub.name}`, dim));
        }
        return Promise.all(promises).then(result => {
          if (result.some(res => res.error)) {
            return true;
          }
          this.structures.delete(name);
          return false;
        });
      } else {
        return Server.runCommand(`structure delete ${name}`, dim).then(result => {
          if (result.error) {
            return true;
          }
          this.structures.delete(name);
          return false;
        });
      }
    }
    return Promise.resolve(true);
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
          const subName = `_${x/this.MAX_SIZE.x}_${y/this.MAX_SIZE.y}_${z/this.MAX_SIZE.z}`;

          subStructs.push({
            name: subName,
            start: subStart,
            end: subEnd
          });
        }
    return subStructs;
  }
}

export const Structure = new StructureManager();
