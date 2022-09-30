/* eslint-disable no-empty */
import { contentLog, regionSize, regionTransformedBounds, Vector } from "../utils/index.js";
import { BlockLocation, Dimension, world } from "@minecraft/server";

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

  save(name: string, start: BlockLocation, end: BlockLocation, dim: Dimension, options: StructureSaveOptions = {}) {
    const min = Vector.min(start, end);
    const max = Vector.max(start, end);
    const size = Vector.from(regionSize(start, end));

    const includeEntities = options.includeEntities ?? false;
    const includeBlocks = options.includeBlocks ?? true;
    const saveTo = (options.saveToDisk ?? false) ? "disk" : "memory";

    if (this.beyondMaxSize(size)) {
      const subStructs = this.getSubStructs(start, end);
      for (const sub of subStructs) {
        const subStart = min.add(sub.start);
        const subEnd = min.add(sub.end);
        const subName = name + sub.name;

        try {
          contentLog.debug(name);
          contentLog.debug(`structure save ${subName} ${subStart.print()} ${subEnd.print()} ${includeEntities} ${saveTo} ${includeBlocks}`);
          dim.runCommand(`structure save ${subName} ${subStart.print()} ${subEnd.print()} ${includeEntities} ${saveTo} ${includeBlocks}`);
        } catch {
          for (const sub of subStructs) {
            try { dim.runCommand(`structure delete ${name + sub.name}`); } catch {}
          }
          return true;
        }
      }

      this.structures.set(name, {
        subRegions: subStructs,
        size: size
      });
      return false;
    } else {
      const startStr = min.print();
      const endStr = max.print();

      try {
        dim.runCommand(`structure save ${name} ${startStr} ${endStr} ${includeEntities} ${saveTo} ${includeBlocks}`);
        this.structures.set(name, {
          size: size
        });
        return false;
      } catch {}
    }
    return true;
  }

  load(name: string, location: BlockLocation, dim: Dimension, options: StructureLoadOptions = {}) {
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

      const bounds = regionTransformedBounds(new BlockLocation(0, 0, 0), size.sub(1).toBlock(), Vector.ZERO, rotation, dir_sc);
      let success = false;
      const subStructs = options.importedSize ?
        this.getSubStructs(location, Vector.add(location, options.importedSize).toBlock()) :
        struct.subRegions;
      for (const sub of subStructs) {
        const subBounds = regionTransformedBounds(sub.start.toBlock(), sub.end.toBlock(), Vector.ZERO, rotation, dir_sc);
        const subLoad = Vector.sub(subBounds[0], bounds[0]).add(loadPos);

        try {
          dim.runCommand(`structure load ${name + sub.name} ${subLoad.print()} ${rot}_degrees ${flip}`);
          success = true;
        } catch {}
      }
      return !success;
    } else {
      try {
        dim.runCommand(`structure load ${name} ${loadPos.print()} ${rot}_degrees ${flip}`);
        return false;
      } catch {}
    }
    return true;
  }

  has(name: string) {
    return this.structures.has(name);
  }

  delete(name: string) {
    const struct = this.structures.get(name);
    const dim = world.getDimension("overworld");
    if (struct) {
      let error = false;
      if (struct.subRegions) {
        for (const sub of struct.subRegions) {
          try {
            dim.runCommand(`structure delete ${name}${sub.name}`);
          } catch {
            error = true;
          }
        }
      } else {
        try {
          dim.runCommand(`structure delete ${name}`);
        } catch {
          error = true;
        }
      }
      this.structures.delete(name);
      return error;
    }
    return true;
  }

  getSize(name: string) {
    return this.structures.get(name).size.toBlock();
  }

  private beyondMaxSize(size: Vector) {
    return size.x > this.MAX_SIZE.x || size.y > this.MAX_SIZE.y || size.z > this.MAX_SIZE.z;
  }

  private getSubStructs(start: BlockLocation, end: BlockLocation) {
    const size = regionSize(start, end);
    const subStructs: SubStructure[] = [];
    for (let z = 0; z < size.z; z += this.MAX_SIZE.z)
      for (let y = 0; y < size.y; y += this.MAX_SIZE.y)
        for (let x = 0; x < size.x; x += this.MAX_SIZE.x) {
          const subStart = new Vector(x, y, z);
          const subEnd = Vector.min(subStart.add(this.MAX_SIZE).sub(1), size.offset(-1, -1, -1));
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
