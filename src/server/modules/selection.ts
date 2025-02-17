import { regionBounds, regionVolume, Vector } from "@notbeer-api";
import { Player, system } from "@minecraft/server";
import { Shape, shapeGenOptions } from "../shapes/base_shape.js";
import { SphereShape } from "../shapes/sphere.js";
import { CuboidShape } from "../shapes/cuboid.js";
import { CylinderShape } from "../shapes/cylinder.js";
import { arraysEqual, getWorldHeightLimits } from "../util.js";
import config from "config.js";

// TODO: Add other selection modes
export const selectionModes = ["cuboid", "extend", "sphere", "cylinder"] as const;
export type selectMode = (typeof selectionModes)[number];

const drawFrequency = 8; // in ticks

export class Selection {
    private _mode: selectMode = "cuboid";
    private _points: Vector[] = [];
    private _visible: boolean | "local" = config.drawOutlines;
    private modeLastDraw: selectMode = this._mode;
    private pointsLastDraw: Vector[] = [];

    private player: Player;
    private drawParticles: [string, Vector][] = [];
    private lastDraw = 0;

    constructor(player: Player) {
        this.player = player;
    }

    get isValid() {
        let points = 0;
        for (const point of this._points) {
            if (point) points++;
        }
        return points != 0 && points != 1;
    }

    /**
     * Sets either the first or second selection point of a selection.
     * @param index The first or second selection point
     * @param loc The location the selection point is being made
     */
    public set(index: 0 | 1, loc: Vector): void {
        if (index > 0 && this._points.length == 0 && this._mode != "cuboid") {
            throw "worldedit.selection.noPrimary";
        }

        if (this._points.length <= index) {
            this._points.length = index + 1;
        }

        if (index == 0 && this._mode != "cuboid") {
            this._points = [loc, loc.offset(0, 0, 0)];
        } else if (this._mode == "cuboid") {
            this._points[index] = loc;
            if (this._mode != "cuboid") {
                this._points.length = 1;
            }
        } else if (this._mode == "extend") {
            this._points[0] = Vector.min(this._points[0], this._points[1]).min(loc).floor();
            this._points[1] = Vector.max(this._points[0], this._points[1]).max(loc).floor();
        } else if (this._mode == "sphere") {
            const radius = Math.round(Vector.sub(loc, this._points[0]).length);
            this._points[1] = new Vector(radius, 0, 0).add(this._points[0]).floor();
        } else if (this._mode == "cylinder") {
            const prevVec = Vector.sub(this._points[1], this._points[0]).mul([1, 0, 1]);
            const vec = Vector.sub(loc, this._points[0]).mul([1, 0, 1]);
            const min = Vector.min(this._points[0], this._points[1]).min(loc);
            const max = Vector.max(this._points[0], this._points[1]).max(loc);
            const radius = Math.round(Math.max(vec.length, prevVec.length));
            this._points[1] = new Vector(radius, 0, 0).add(this._points[0]).floor();
            this._points[0].y = min.y;
            this._points[1].y = max.y;
        }

        const [min, max] = getWorldHeightLimits(this.player.dimension);
        this._points.forEach((p) => (p.y = Math.min(Math.max(p.y, min), max)));
    }

    /**
     * Clears the selection points that have been made.
     */
    public clear() {
        if (this._points.length) {
            this._points = [];
        }
    }

    /**
     * Get the shape of the current selection
     * @returns
     */
    public getShape(): [Shape, Vector] {
        if (!this.isValid) return null;

        if (this.isCuboid()) {
            const [start, end] = regionBounds(this._points);
            const size = Vector.sub(end, start).add(1);
            return [new CuboidShape(size.x, size.y, size.z), Vector.from(start)];
        } else if (this._mode == "sphere") {
            const center = this._points[0];
            const radius = Vector.sub(this._points[1], this._points[0]).length;
            return [new SphereShape(radius), center];
        } else if (this._mode == "cylinder") {
            const center = this._points[0];
            const vec = Vector.sub(this._points[1], this._points[0]);
            const height = Math.abs(vec.y) + 1;
            return [new CylinderShape(height, Math.round(vec.mul([1, 0, 1]).length)), center.offset(0, height / 2, 0)];
        }
    }

    /**
     * @return The blocks within the current selection
     */
    public *getBlocks(options?: shapeGenOptions) {
        if (!this.isValid) return;

        const [shape, loc] = this.getShape();
        yield* shape.getBlocks(loc, options);
    }

    /**
     * Returns the exact or approximate number of blocks the selection encompasses.
     * @returns
     */
    public getBlockCount() {
        if (!this.isValid) return 0;

        if (this.isCuboid()) {
            return regionVolume(this._points[0], this._points[1]);
        } else if (this._mode == "sphere") {
            const radius = Vector.sub(this._points[1], this._points[0]).length;
            return Math.round((4 / 3) * Math.PI * Math.pow(radius, 3));
        } else if (this._mode == "cylinder") {
            const vec = Vector.sub(this._points[1], this._points[0]);
            const height = Math.abs(vec.y) + 1;
            const radius = Math.round(vec.mul([1, 0, 1]).length) + 0.5;
            return Math.ceil(Math.pow(radius, 2) * Math.PI * height);
        }
    }

    /**
     * @return The minimum and maximum points of the selection
     */
    public getRange(): [Vector, Vector] {
        const [shape, loc] = this.getShape();
        if (shape) {
            return shape.getRegion(loc);
        }
        return null;
    }

    public isCuboid(): boolean {
        return this._mode == "cuboid" || this._mode == "extend";
    }

    public draw(): void {
        if (!this._visible) return;
        if (system.currentTick > this.lastDraw + drawFrequency) {
            if (this._mode != this.modeLastDraw || !arraysEqual(this._points, this.pointsLastDraw, (a, b) => a.equals(b))) {
                this.drawParticles.length = 0;
                if (this.isValid) {
                    const [shape, loc] = this.getShape();
                    this.drawParticles.push(...shape.getOutline(loc));
                }
                this.modeLastDraw = this._mode;
                this.pointsLastDraw = this.points;
            }

            try {
                for (const [id, loc] of this.drawParticles) {
                    try {
                        this.player.spawnParticle(id, loc);
                    } catch {
                        /* pass */
                    }
                }
            } catch {
                /* pass */
            }
            this.lastDraw = system.currentTick;
        }
    }

    public forceDraw(): void {
        this.lastDraw = 0;
        this.draw();
    }

    public get mode(): selectMode {
        return this._mode;
    }

    public set mode(value: selectMode) {
        if (this._mode == value) return;

        const wasCuboid = this.isCuboid();
        this._mode = value;
        if (!this.isCuboid() || wasCuboid != this.isCuboid()) {
            this.clear();
        }
    }

    public get points() {
        return this._points.map((v) => v.clone());
    }

    public get visible(): boolean | "local" {
        return this._visible;
    }

    public set visible(value: boolean | "local") {
        this._visible = value;
    }
}
