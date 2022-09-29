import { Mask } from "@modules/mask.js";
import { BlockLocation } from "mojang-minecraft";
import { PlayerSession } from "../../sessions.js";
import { Shape } from "../../shapes/base_shape.js";
import { getWorldMaxY, getWorldMinY } from "../../util.js";

type map = (number | null)[][];

export function* smooth(session: PlayerSession, iter: number, shape: Shape, loc: BlockLocation, heightMask: Mask, mask: Mask): Generator<number|string, number> {
  const range = shape.getRegion(loc);
  range[0].y = Math.max(getWorldMinY(session.getPlayer()), range[0].y);
  range[1].y = Math.min(getWorldMaxY(session.getPlayer()), range[1].y);
  mask = mask ? mask.intersect(session.globalMask) : session.globalMask;

  function getMap(arr: map, x: number, z: number) {
    return arr[x]?.[z] ?? null;
  }

  function createMap(sizeX: number, sizeZ: number): map {
    const arr = [];
    for (let x = 0; x < sizeX; x++) {
      const arrX = [];
      for (let z = 0; z < sizeZ; z++) {
        arrX.push(null);
      }
      arr.push(arrX);
    }
    return arr;
  }

  function* modifyMap(arr: map, func: (x: number, z: number) => (number | null), jobMsg: string): Generator<number|string> {
    let count = 0;
    const size = arr.length * arr[0].length;
    yield jobMsg;
    for (let x = 0; x < arr.length; x++) {
      for (let z = 0; z < arr[x].length; z++) {
        arr[x][z] = func(x, z);
        yield ++count / size;
      }
    }
  }

  const [sizeX, sizeZ] = [range[1].x - range[0].x + 1, range[1].z - range[0].z + 1];
  const map = createMap(sizeX, sizeZ);
  const bottom = createMap(sizeX, sizeZ);
  const top = createMap(sizeX, sizeZ);
  const base = createMap(sizeX, sizeZ);

  const player = session.getPlayer();
  const dim = player.dimension;
  const minY = getWorldMinY(player);
  const maxY = getWorldMaxY(player);

  yield* modifyMap(map, (x, z) => {
    const yRange = shape.getYRange(x, z);
    if (yRange == null) return;

    yRange[0] = Math.max(yRange[0] + loc.y, minY);
    yRange[1] = Math.min(yRange[1] + loc.y, maxY);
    let h: BlockLocation;

    for (h = new BlockLocation(x + range[0].x, yRange[1], z + range[0].z); h.y >= yRange[0]; h.y--) {
      if (dim.getBlock(h).id != "minecraft:air" && heightMask.matchesBlock(h, dim)) {
        break;
      }
    }
    if (h.y != yRange[0] - 1) {
      base[x][z] = h.y;
      bottom[x][z] = yRange[0];
      top[x][z] = yRange[1];
      return h.y;
    }
  }, "Getting heightmap..."); // TODO: Localize

  const back = createMap(sizeX, sizeZ);
  for (let i = 0; i < iter; i++) {
    yield* modifyMap(back, (x, z) => {
      const c = getMap(map, x, z);
      if (c == null) return null;

      let height = c * 0.6;
      height += (getMap(map, x, z - 1) ?? c) * 0.2;
      height += (getMap(map, x, z + 1) ?? c) * 0.2;
      return height;
    }, "Smoothing height map...");
    yield* modifyMap(map, (x, z) => {
      const c = getMap(back, x, z);
      if (c == null) return null;

      let height = c * 0.6;
      height += (getMap(back, x - 1, z) ?? c) * 0.2;
      height += (getMap(back, x + 1, z) ?? c) * 0.2;
      return height;
    }, "Smoothing height map...");
  }

  let count = 0;
  const history = session.getHistory();
  const record = history.record();
  const tempBlock = session.createRegion(true);
  try {
    history.addUndoStructure(record, range[0], range[1], "any");
    yield* modifyMap(back, (x, z) => {
      if (getMap(map, x, z) == null) return;

      const oldHeight = getMap(base, x, z);
      const minY = getMap(bottom, x, z);
      const maxY = getMap(top, x, z);
      const heightDiff = getMap(map, x, z) - oldHeight;

      if (heightDiff >= 0.5) {
        for (let h = new BlockLocation(x + range[0].x, maxY, z + range[0].z); h.y >= minY; h.y--) {
          const newH = new BlockLocation(h.x, Math.max(h.y - heightDiff, minY - 1), h.z);
          if (dim.getBlock(newH).type.id == "minecraft:air" || mask.matchesBlock(newH, dim)) {
            tempBlock.save(newH, newH, dim);
          }
          if (dim.getBlock(h).type.id == "minecraft:air" || mask.matchesBlock(h, dim)) {
            tempBlock.load(h, dim);
          }
          count++;
        }
      } else if (heightDiff <= -0.5) {
        for (let h = new BlockLocation(x + range[0].x, minY, z + range[0].z); h.y <= maxY; h.y++) {
          const newH = new BlockLocation(h.x, Math.min(h.y - heightDiff, maxY + 1), h.z);
          if (dim.getBlock(newH).id == "minecraft:air" || mask.matchesBlock(newH, dim)) {
            tempBlock.save(newH, newH, dim);
          }
          if (dim.getBlock(h).id == "minecraft:air" || mask.matchesBlock(h, dim)) {
            tempBlock.load(h, dim);
          }
          count++;
        }
      }
      return 0;
    }, "Generating blocks...");
    history.addRedoStructure(record, range[0], range[1], "any");
    history.commit(record);
  } catch (e) {
    history.cancel(record);
    throw e;
  } finally {
    session.deleteRegion(tempBlock);
  }

  return count;
}
