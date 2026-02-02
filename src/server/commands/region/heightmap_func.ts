import { Vector3, VectorXZ } from "@minecraft/server";
import { JobFunction, Jobs } from "../../modules/jobs.js";
import { Mask } from "../../modules/mask.js";
import { PlayerSession } from "../../sessions.js";
import { Shape } from "../../shapes/base_shape.js";
import { Vector, VectorSet } from "@notbeer-api";
import { recordBlockChanges } from "@modules/block_changes.js";

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

    const map = new VectorSet<Column<any>>();
    const chunks = new Map<string, Column<any>[]>();

    mask = (mask ?? new Mask()).intersect(session.globalMask).withContext(session);
    heightMask = heightMask.withContext(session);

    const { min: dimMin, max: dimMax } = dim.heightRange;

    // Create height map
    yield Jobs.nextStep("commands.wedit:heightmap.getting");
    // TODO: Sort locations by height to reduce "overdraw"
    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const [subMin, subMax] = shape.getRegion(Vector.ZERO);
        const area = (subMin.x + 1) * (subMax.z + 1);
        let count = 0;
        for (let z = subMin.z; z <= subMax.z; z++) {
            for (let x = subMin.x; x <= subMax.x; x++) {
                yield Jobs.setProgress((i + count++ / area) / locations.length);
                const coords = { x: x + loc.x, y: 0, z: z + loc.z };
                // TODO: Check if the existing column is higher
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
                    const column = new Column(coords, ...yRange, h.y);
                    map.add(column);

                    const chunkKey = `${Math.floor(coords.x / 8)} ${Math.floor(coords.z / 8)}`;
                    if (!chunks.has(chunkKey)) chunks.set(chunkKey, []);
                    chunks.get(chunkKey).push(column);
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
    let columnsProcessed = 0;
    const history = session.history;
    const record = history.record();
    try {
        yield Jobs.nextStep("commands.wedit:heightmap.placing");

        for (const chunk of chunks.values()) {
            const blockChanges = recordBlockChanges(session, record);
            for (const column of chunk) {
                yield Jobs.setProgress(columnsProcessed++ / map.size);

                const initialHeight = Math.floor(column.initialHeight);
                const newHeight = Math.floor(column.height);
                const difference = initialHeight - newHeight;
                const direction = Math.sign(difference);
                if (!difference) continue;

                for (let y = newHeight; y !== initialHeight + direction; y += direction) {
                    const location = { x: column.x, y, z: column.z };
                    const sampleY = Math.min(Math.max(y + difference, dimMin), dimMax - 1);
                    const sampledBlock = yield* Jobs.loadBlock({ ...location, y: sampleY });
                    if (sampledBlock.isAir || mask!.matchesBlock(sampledBlock)) {
                        blockChanges.setBlock(location, sampledBlock.permutation);
                        count++;
                    }
                }
            }
            yield* blockChanges.flush();
        }

        yield* history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    }

    return count;
}
