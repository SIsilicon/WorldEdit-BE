/* eslint-disable no-empty */
import { regionSize, regionTransformedBounds, Vector } from "../utils/index.js";
import { BlockLocation, Dimension, world } from "mojang-minecraft";

interface StructureMeta {
    subRegions?: [string, Vector, Vector][]; // name suffix, offset, end
    size: Vector;
}

export interface StructureSaveOptions {
    includeEntities?: boolean,
    includeBlocks?: boolean
}

export interface StructureLoadOptions {
    rotation?: number,
    flip?: "none"|"x"|"z"|"xz"
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

    if (size.x > this.MAX_SIZE.x || size.y > this.MAX_SIZE.y || size.z > this.MAX_SIZE.z) {
      const subStructs: [string, Vector, Vector][] = [];
      for (let z = 0; z < size.z; z += this.MAX_SIZE.z)
        for (let y = 0; y < size.y; y += this.MAX_SIZE.y)
          for (let x = 0; x < size.x; x += this.MAX_SIZE.x) {
            const subStart = min.add([x, y, z]);
            const subEnd = Vector.min(
              new Vector(x, y, z).add(this.MAX_SIZE), size
            ).add(min).sub(Vector.ONE);
            const subName = `_${x/this.MAX_SIZE.x}_${y/this.MAX_SIZE.y}_${z/this.MAX_SIZE.z}`;

            try {
              dim.runCommand(`structure save ${name + subName} ${subStart.print()} ${subEnd.print()} ${includeEntities} memory ${includeBlocks}`);
              subStructs.push([
                subName,
                new Vector(x, y, z),
                subEnd.sub(min).add(Vector.ONE)
              ]);
            } catch {
              for (const sub of subStructs) {
                try { dim.runCommand(`structure delete ${name + sub[0]}`); } catch {}
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
        dim.runCommand(`structure save ${name} ${startStr} ${endStr} ${includeEntities} memory ${includeBlocks}`);
        this.structures.set(name, {
          size: size
        });
        return false;
      } catch {}
    }
    return true;
  }

  load(name: string, location: BlockLocation, dim: Dimension, options: StructureLoadOptions = {}) {
    const struct = this.structures.get(name);
    if (struct) {
      const loadPos = Vector.from(location);
      let rot = (options.rotation ?? 0);
      rot = rot >= 0 ? rot % 360 : (rot % 360 + 360) % 360;
      const flip = options.flip ?? "none";

      if (struct.subRegions) {
        const rotation = new Vector(0, options.rotation ?? 0, 0);
        const flip = options.flip ?? "none";
        const dir_sc = Vector.ONE;
        if (flip.includes("x")) dir_sc.z *= -1;
        if (flip.includes("z")) dir_sc.x *= -1;

        const bounds = regionTransformedBounds(new BlockLocation(0, 0, 0), struct.size.sub(1).toBlock(), Vector.ZERO, rotation, dir_sc);
        let success = false;
        for (const sub of struct.subRegions) {
          const subBounds = regionTransformedBounds(sub[1].toBlock(), sub[2].toBlock(), Vector.ZERO, rotation, dir_sc);
          const subLoad = Vector.sub(subBounds[0], bounds[0]).add(loadPos);

          try {
            dim.runCommand(`structure load ${name + sub[0]} ${subLoad.print()} ${rot}_degrees ${flip}`);
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
            dim.runCommand(`structure delete ${name}_${sub[0]}_${sub[1]}_${sub[2]}`);
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
}

export const Structure = new StructureManager();
