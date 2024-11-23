import { Mask } from "@modules/mask.js";
import { Vector } from "@notbeer-api";
import { PlayerSession } from "../../sessions.js";
import { Shape } from "../../shapes/base_shape.js";
import { getWorldHeightLimits } from "../../util.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { Vector3 } from "@minecraft/server";
import { JobFunction, Jobs } from "@modules/jobs.js";

type map = (number | null)[][];

// TODO: Function with Job block loader
export function* smooth(session: PlayerSession, iter: number, shape: Shape, loc: Vector3, heightMask: Mask, mask: Mask): Generator<JobFunction | Promise<unknown>, number> {
    const range = shape.getRegion(loc);
    const player = session.getPlayer();
    const dim = player.dimension;

    const [minY, maxY] = getWorldHeightLimits(dim);
    range[0].y = Math.max(range[0].y, minY);
    range[1].y = Math.min(range[1].y, maxY);
    mask = (mask ? mask.intersect(session.globalMask) : session.globalMask)?.withContext(session);
    heightMask = heightMask.withContext(session);

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

    function* modifyMap(arr: map, func: (x: number, z: number) => number | null, jobMsg: string): Generator<JobFunction> {
        let count = 0;
        const size = arr.length * arr[0].length;
        yield Jobs.nextStep(jobMsg);
        for (let x = 0; x < arr.length; x++) {
            for (let z = 0; z < arr[x].length; z++) {
                arr[x][z] = func(x, z);
                yield Jobs.setProgress(++count / size);
            }
        }
    }

    const [sizeX, sizeZ] = [range[1].x - range[0].x + 1, range[1].z - range[0].z + 1];
    const map = createMap(sizeX, sizeZ);
    const bottom = createMap(sizeX, sizeZ);
    const top = createMap(sizeX, sizeZ);
    const base = createMap(sizeX, sizeZ);

    yield* modifyMap(
        map,
        (x, z) => {
            const yRange = shape.getYRange(x, z);
            if (!yRange) return;

            yRange[0] = Math.max(yRange[0] + loc.y, minY);
            yRange[1] = Math.min(yRange[1] + loc.y, maxY);
            let h: Vector3;

            for (h = new Vector(x + range[0].x, yRange[1], z + range[0].z); h.y >= yRange[0]; h.y--) {
                if (!dim.getBlock(h).isAir && heightMask.matchesBlock(dim.getBlock(h))) {
                    break;
                }
            }
            if (h.y != yRange[0] - 1) {
                base[x][z] = h.y;
                bottom[x][z] = yRange[0];
                top[x][z] = yRange[1];
                return h.y;
            }
        },
        "Getting heightmap..."
    ); // TODO: Localize

    const back = createMap(sizeX, sizeZ);
    for (let i = 0; i < iter; i++) {
        yield* modifyMap(
            back,
            (x, z) => {
                const c = getMap(map, x, z);
                if (c == null) return null;

                let height = c * 0.6;
                height += (getMap(map, x, z - 1) ?? c) * 0.2;
                height += (getMap(map, x, z + 1) ?? c) * 0.2;
                return height;
            },
            "Smoothing height map..."
        );
        yield* modifyMap(
            map,
            (x, z) => {
                const c = getMap(back, x, z);
                if (c == null) return null;

                let height = c * 0.6;
                height += (getMap(back, x - 1, z) ?? c) * 0.2;
                height += (getMap(back, x + 1, z) ?? c) * 0.2;
                return height;
            },
            "Smoothing height map..."
        );
    }

    let count = 0;
    const history = session.getHistory();
    const record = history.record();
    const rangeYDiff = range[1].y - range[0].y;
    let warpBuffer: RegionBuffer;
    try {
        yield* history.addUndoStructure(record, range[0], range[1], "any");

        yield Jobs.nextStep("Calculating blocks...");
        warpBuffer = yield* RegionBuffer.create(range[0], range[1], (loc) => {
            const canSmooth = (loc: Vector3) => {
                const global = Vector.add(loc, range[0]);
                return dim.getBlock(global).isAir || mask.matchesBlock(dim.getBlock(global));
            };

            if (canSmooth(loc)) {
                const heightDiff = getMap(map, loc.x, loc.z) - getMap(base, loc.x, loc.z);
                const sampleLoc = Vector.add(loc, [0, -heightDiff, 0]).round();
                sampleLoc.y = Math.min(Math.max(sampleLoc.y, 0), rangeYDiff);
                if (canSmooth(sampleLoc)) return dim.getBlock(sampleLoc.add(range[0]));
            }
        });

        yield Jobs.nextStep("Placing blocks...");
        yield* warpBuffer.load(range[0], dim);
        count = warpBuffer.getVolume();

        yield* history.addRedoStructure(record, range[0], range[1], "any");
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        warpBuffer?.deref();
    }

    return count;
}
