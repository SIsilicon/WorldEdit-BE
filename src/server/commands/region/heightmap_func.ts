import { Vector3, VectorXZ } from "@minecraft/server";
import { JobFunction, Jobs } from "../../modules/jobs.js";
import { Mask } from "../../modules/mask.js";
import { RegionBuffer } from "../../modules/region_buffer.js";
import { PlayerSession } from "../../sessions.js";
import { Shape } from "../../shapes/base_shape.js";
import { Vector, VectorSet } from "@notbeer-api";

class Column<T extends object> {
    readonly y = 0;
    readonly x: number;
    readonly z: number;

    readonly initialHeight: number;

    data: T = {} as any;

    constructor(
        coord: VectorXZ,
        public minHeight: number,
        public maxHeight: number,
        public height: number
    ) {
        this.x = coord.x;
        this.z = coord.z;
        this.initialHeight = height;
    }
}

type Map<T extends object = Record<string, any>> = VectorSet<Column<T>>;

const API = {
    modifyMap: function* (map: Map, callback: (coord: VectorXZ) => Generator<any, void> | void, jobMsg: string): Generator<JobFunction> {
        let count = 0;
        const size = map.size;
        yield Jobs.nextStep(jobMsg);
        for (const coord of map) {
            callback(coord);
            yield Jobs.setProgress(++count / size);
        }
    },

    getColumn: function <T extends object>(map: Map<T>, x: number, z: number) {
        return map.get({ x, y: 0, z });
    },
};

export function* smooth(session: PlayerSession, iter: number, shape: Shape, locations: Vector3 | Vector3[], heightMask: Mask, mask?: Mask): Generator<JobFunction | Promise<unknown>, number> {
    return yield* modifyHeight(
        session,
        function* (map: Map<{ back: number }>, API) {
            for (let i = 0; i < iter; i++) {
                yield* API.modifyMap(
                    map,
                    ({ x, z }) => {
                        const column = API.getColumn(map, x, z);
                        if (column.height == undefined) return;

                        let height = column.height * 0.6;
                        height += (API.getColumn(map, x, z - 1)?.height ?? column.height) * 0.2;
                        height += (API.getColumn(map, x, z + 1)?.height ?? column.height) * 0.2;

                        column.data.back = height;
                    },
                    "worldbuilder.oreville_wb:job.height.smooth"
                );
                yield* API.modifyMap(
                    map,
                    ({ x, z }) => {
                        const column = API.getColumn(map, x, z);
                        if (column.data.back === undefined) return;

                        let height = column.data.back * 0.6;
                        height += (API.getColumn(map, x - 1, z)?.data.back ?? column.data.back) * 0.2;
                        height += (API.getColumn(map, x + 1, z)?.data.back ?? column.data.back) * 0.2;

                        column.height = height;
                    },
                    "worldbuilder.oreville_wb:job.height.smooth"
                );
            }
        },
        shape,
        locations,
        heightMask,
        mask
    );
}

export function* modifyHeight(
    session: PlayerSession,
    modify: (columns: Map, api: typeof API) => Generator<JobFunction>,
    shape: Shape,
    locations: Vector3 | Vector3[],
    heightMask: Mask,
    mask?: Mask
): Generator<JobFunction | Promise<unknown>, number> {
    if (!Array.isArray(locations)) locations = [locations];

    const player = session.player;
    const dim = player.dimension;

    let min = new Vector(Infinity, Infinity, Infinity);
    let max = new Vector(-Infinity, -Infinity, -Infinity);
    const map = new VectorSet<Column<any>>();

    mask = (mask ?? new Mask()).intersect(session.globalMask).withContext(session);
    heightMask = heightMask.withContext(session);

    const { min: dimMin, max: dimMax } = dim.heightRange;

    // Create height map
    yield Jobs.nextStep("commands.wedit:heightmap.getting");
    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const [subMin, subMax] = shape.getRegion(Vector.ZERO);
        const area = (subMin.x + 1) * (subMax.z + 1);
        let count = 0;
        for (let z = subMin.z; z <= subMax.z; z++) {
            for (let x = subMin.x; x <= subMax.x; x++) {
                yield Jobs.setProgress((i + count++ / area) / locations.length);
                const coords = { x: x + loc.x, y: 0, z: z + loc.z };
                if (map.has(coords)) continue;

                const yRange = shape.getYRange(x, z);
                if (!yRange) continue;

                yRange[0] = Math.max(yRange[0] + loc.y, dimMin);
                yRange[1] = Math.min(yRange[1] + loc.y, dimMax);

                let h: Vector3;
                for (h = new Vector(coords.x, yRange[1], coords.z); h.y >= yRange[0]; h.y--) {
                    const block = (yield* Jobs.loadBlock(h))!;
                    if (!block.isAir && heightMask.matchesBlock(block)) break;
                }

                if (h.y !== yRange[0] - 1) {
                    map.add(new Column(coords, ...yRange, h.y));
                    min = min.min({ ...coords, y: yRange[0] });
                    max = max.max({ ...coords, y: yRange[1] });
                }
            }
        }
    }

    // If the height map is empty, don't go any further
    if (!map.size) return;

    // Modify the height map
    yield* modify(map, API);

    // Move the blocks in the world according to the modified height map
    let count = 0;
    const history = session.history;
    const record = history.record();
    let warpBuffer: RegionBuffer | undefined;
    try {
        yield* history.trackRegion(record, min, max);

        yield Jobs.nextStep("commands.wedit:heightmap.placing");
        for (const column of map.values()) {
            const min = { x: column.x, y: column.minHeight, z: column.z };
            const max = { x: column.x, y: column.maxHeight, z: column.z };
            const rangeYDiff = max.y - min.y;
            warpBuffer = yield* RegionBuffer.create(min, max, function* (loc) {
                function* canSmooth(loc: Vector3) {
                    const globalLoc = Vector.add(loc, min);
                    const block = (yield* Jobs.loadBlock(globalLoc))!;
                    return block.isAir || mask!.matchesBlock(block);
                }

                if (yield* canSmooth(loc)) {
                    const heightDiff = column.height - column.initialHeight;
                    const sampleLoc = Vector.add(loc, [0, -heightDiff, 0]).round();
                    sampleLoc.y = Math.min(Math.max(sampleLoc.y, 0), rangeYDiff);
                    if (yield* canSmooth(sampleLoc)) return dim.getBlock(sampleLoc.add(min));
                }
            });

            if (warpBuffer) {
                yield* warpBuffer.load(min, dim);
                count += warpBuffer.getVolume();
                warpBuffer.deref();
                warpBuffer = undefined;
            }
        }
        yield* history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        warpBuffer?.deref();
    }

    return count;
}
