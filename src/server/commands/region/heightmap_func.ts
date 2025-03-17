import { Vector3, VectorXZ } from "@minecraft/server";
import { JobFunction, Jobs } from "../../modules/jobs.js";
import { Mask } from "../../modules/mask.js";
import { RegionBuffer } from "../../modules/region_buffer.js";
import { PlayerSession } from "../../sessions.js";
import { Shape } from "../../shapes/base_shape.js";
import { Vector } from "@notbeer-api";

type map = (number | undefined)[][];

const API = {
    createMap: function (sizeX: number, sizeZ: number): map {
        const arr: map = [];
        for (let x = 0; x < sizeX; x++) {
            const arrX: (number | undefined)[] = [];
            for (let z = 0; z < sizeZ; z++) arrX.push(undefined);
            arr.push(arrX);
        }
        return arr;
    },

    modifyMap: function* (arr: map, func: (x: number, z: number) => Generator<any, number | undefined> | number | undefined, jobMsg: string): Generator<JobFunction> {
        let count = 0;
        const size = arr.length * arr[0].length;
        yield Jobs.nextStep(jobMsg);
        for (let x = 0; x < arr.length; x++) {
            for (let z = 0; z < arr[x].length; z++) {
                const result = func(x, z);
                arr[x][z] = <number>(result && typeof result === "object" ? yield* result : result);
                yield Jobs.setProgress(++count / size);
            }
        }
    },

    getMap: function (arr: map, x: number, z: number) {
        return arr[x]?.[z] ?? undefined;
    },
};

export function* smooth(session: PlayerSession, iter: number, shape: Shape, loc: Vector3, heightMask: Mask, mask?: Mask): Generator<JobFunction | Promise<unknown>, number> {
    return yield* modifyHeight(
        session,
        function* ({ x: sizeX, z: sizeZ }, map, API) {
            const back = API.createMap(sizeX, sizeZ);
            for (let i = 0; i < iter; i++) {
                yield* API.modifyMap(
                    back,
                    (x, z) => {
                        const c = API.getMap(map, x, z);
                        if (c == undefined) return undefined;

                        let height = c * 0.6;
                        height += (API.getMap(map, x, z - 1) ?? c) * 0.2;
                        height += (API.getMap(map, x, z + 1) ?? c) * 0.2;
                        return height;
                    },
                    "worldbuilder.oreville_wb:job.height.smooth"
                );
                yield* API.modifyMap(
                    map,
                    (x, z) => {
                        const c = API.getMap(back, x, z);
                        if (c == undefined) return undefined;

                        let height = c * 0.6;
                        height += (API.getMap(back, x - 1, z) ?? c) * 0.2;
                        height += (API.getMap(back, x + 1, z) ?? c) * 0.2;
                        return height;
                    },
                    "worldbuilder.oreville_wb:job.height.smooth"
                );
            }
        },
        shape,
        loc,
        heightMask,
        mask
    );
}

export function* modifyHeight(
    session: PlayerSession,
    modify: (size: VectorXZ, heightMap: map, api: typeof API) => Generator<JobFunction>,
    shape: Shape,
    loc: Vector3,
    heightMask: Mask,
    mask?: Mask
): Generator<JobFunction | Promise<unknown>, number> {
    const [min, max] = shape.getRegion(loc);
    const player = session.getPlayer();
    const dim = player.dimension;

    const { min: minY, max: maxY } = dim.heightRange;
    min.y = Math.max(minY, min.y);
    max.y = Math.min(maxY - 1, max.y);
    mask = (mask ? mask.intersect(session.globalMask) : session.globalMask)?.clone() ?? new Mask();
    heightMask = heightMask.clone();

    const [sizeX, sizeZ] = [max.x - min.x + 1, max.z - min.z + 1];
    const map = API.createMap(sizeX, sizeZ);
    const bottom = API.createMap(sizeX, sizeZ);
    const top = API.createMap(sizeX, sizeZ);
    const base = API.createMap(sizeX, sizeZ);

    yield* API.modifyMap(
        map,
        function* (x, z) {
            const yRange = shape.getYRange(x, z);
            if (!yRange) return;

            yRange[0] = Math.max(yRange[0] + loc.y, minY);
            yRange[1] = Math.min(yRange[1] + loc.y, maxY);
            let h: Vector3;

            for (h = new Vector(x + min.x, yRange[1], z + min.z); h.y >= yRange[0]; h.y--) {
                const block = dim.getBlock(h) ?? (yield* Jobs.loadBlock(h))!;
                if (!block.isAir && heightMask.matchesBlock(block)) break;
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

    yield* modify({ x: sizeX, z: sizeZ }, map, API);

    let count = 0;
    const history = session.getHistory();
    const record = history.record();
    const rangeYDiff = max.y - min.y;
    let warpBuffer: RegionBuffer | undefined;
    try {
        yield* history.addUndoStructure(record, min, max, "any");

        yield Jobs.nextStep("Calculating blocks...");
        warpBuffer = yield* RegionBuffer.create(min, max, function* (loc) {
            function* canSmooth(loc: Vector3) {
                const globalLoc = Vector.add(loc, min);
                const global = dim.getBlock(globalLoc) ?? (yield* Jobs.loadBlock(globalLoc))!;
                return global.isAir || mask!.matchesBlock(global);
            }

            if (yield* canSmooth(loc)) {
                const heightDiff = API.getMap(map, loc.x, loc.z)! - API.getMap(base, loc.x, loc.z)!;
                const sampleLoc = Vector.add(loc, [0, -heightDiff, 0]).round();
                sampleLoc.y = Math.min(Math.max(sampleLoc.y, 0), rangeYDiff);
                if (!isNaN(heightDiff) && (yield* canSmooth(sampleLoc))) return dim.getBlock(sampleLoc.add(min));
            }
        });

        yield Jobs.nextStep("Placing blocks");
        if (warpBuffer) {
            yield* warpBuffer.load(min, dim);
            count = warpBuffer.getVolume();
        }
        yield* history.addRedoStructure(record, min, max, "any");
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        warpBuffer?.deref();
    }

    return count;
}
