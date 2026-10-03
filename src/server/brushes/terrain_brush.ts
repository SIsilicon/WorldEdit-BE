import { Vector3 } from "@minecraft/server";
import { Mask } from "@modules/mask.js";
import { Vector } from "@notbeer-api";
import { Shape } from "server/shapes/base_shape.js";
import { CylinderShape } from "server/shapes/cylinder.js";

import { modifyHeight } from "../commands/region/heightmap_func.js";
import { PlayerSession } from "../sessions.js";
import { brushTypes, Brush } from "./base_brush.js";
import { sampleTerrainHeightmap } from "./terrain_heightmaps.js";

export type TerrainBrushMode = "pull" | "push";

export class TerrainBrush extends Brush {
    public readonly id = "terrain_brush";

    // One click = one terrain operation.
    public readonly usesStrokes = false;

    public intensity: number;
    public mode: TerrainBrushMode;
    public heightmap: string;
    public flat: boolean;

    private shape: CylinderShape;
    private _radius: number;
    private stamp: Uint8Array;
    private stampDiameter = 0;
    private stampRadius = -1;
    private stampHeightmap = "";

    private rebuildStamp() {
        const radius = this.radius;
        const diameter = radius * 2 + 1;

        this.stamp = new Uint8Array(diameter * diameter);

        for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = dx / radius;
                const nz = dz / radius;

                // Outside the circular brush footprint.
                if (nx * nx + nz * nz > 1) {
                    continue;
                }

                const u = nx * 0.5 + 0.5;
                const v = nz * 0.5 + 0.5;

                const strength = sampleTerrainHeightmap(this.heightmap, u, v);

                if (strength <= 0) {
                    continue;
                }

                const index = (dz + radius) * diameter + (dx + radius);

                this.stamp[index] = Math.round(strength * 255);
            }
        }

        this.stampDiameter = diameter;
        this.stampRadius = radius;
        this.stampHeightmap = this.heightmap;
    }

    private ensureStamp() {
        if (!this.stamp || this.stampRadius !== this.radius || this.stampHeightmap !== this.heightmap) {
            this.rebuildStamp();
        }
    }

    constructor(radius: number, intensity: number, mode: TerrainBrushMode, heightmap = "mountain1", flat = false) {
        super();

        this.radius = radius;
        this.intensity = intensity;
        this.mode = mode;
        this.heightmap = heightmap;
        this.flat = flat;
    }

    public get radius() {
        return this._radius;
    }

    public set radius(value: number) {
        // Intentionally do NOT call assertSizeInRange().
        // Terrain brushes are allowed to exceed the normal brush limit.
        this._radius = value;
        this.shape = new CylinderShape(value + 2, value);
    }

    public *apply(locations: Vector[], session: PlayerSession) {
        const center = locations[locations.length - 1];

        this.ensureStamp();

        yield* modifyHeight(
            session,
            function* (map, API) {
                yield* API.modifyMap(
                    map,
                    ({ x, z }) => {
                        const dx = x - center.x;
                        const dz = z - center.z;

                        if (dx < -this.radius || dx > this.radius || dz < -this.radius || dz > this.radius) {
                            return;
                        }

                        const index = (dz + this.radius) * this.stampDiameter + (dx + this.radius);

                        const strength = this.stamp[index];

                        if (strength === 0) {
                            return;
                        }

                        const column = API.getColumn(map, x, z);

                        const amount = (strength / 255) * this.intensity;

                        if (this.mode === "pull") {
                            if (this.flat) {
                                if (column.height >= center.y) {
                                    return;
                                }

                                column.height = Math.min(column.height + amount, center.y);
                            } else {
                                column.height += amount;
                            }
                        } else {
                            if (this.flat) {
                                if (column.height <= center.y) {
                                    return;
                                }

                                column.height = Math.max(column.height - amount, center.y);
                            } else {
                                column.height -= amount;
                            }
                        }
                    },
                    ""
                );
            }.bind(this),
            this.shape,
            [Vector.from(center)],
            new Mask()
        );
    }

    public getOutline(): [Shape, Vector3] {
        return [new CylinderShape(this.radius + 2, this.radius), Vector.ZERO];
    }

    public toJSON() {
        return {
            id: this.id,
            radius: this.radius,
            intensity: this.intensity,
            mode: this.mode,
            heightmap: this.heightmap,
            flat: this.flat,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static parseJSON(json: { [key: string]: any }) {
        return [json.radius, json.intensity, json.mode, json.heightmap ?? "mountain1", json.flat ?? false];
    }
}

brushTypes.set("terrain_brush", TerrainBrush);
