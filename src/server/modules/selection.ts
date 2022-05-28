import { regionBounds, regionVolume, Server, Vector } from "@notbeer-api";
import { BlockLocation, Player } from "mojang-minecraft";
import { Shape } from "../shapes/base_shape.js";
import { CuboidShape } from "../shapes/cuboid.js";
import { getWorldMaxY, getWorldMinY } from "../util.js";

export const selectModes = ['cuboid', 'extend'] as const;
export type selectMode = typeof selectModes[number];

export class Selection {
    private _mode: selectMode = 'cuboid';
    private _points: BlockLocation[] = [];
    private _visible: boolean = true;
    
    private player: Player;
    private drawPoints: Vector[] = [];
    private drawTimer: number = 0;

    constructor(player: Player) {
        this.player = player;
    }

    /**
    * Sets either the first or second selection point of a selection.
    * @param index The first or second selection point
    * @param loc The location the selection point is being made
    */
    public set(index: 0|1, loc: BlockLocation): void {
        if (index > 0 && this._points.length == 0 && this._mode != 'cuboid') {
            throw 'worldedit.selection.noPrimary';
        }
        if (this._points.length <= index) {
            this._points.length = index + 1;
        }
        
        if (this._mode == 'cuboid') {
            this._points[index] = loc;
            if (this._mode != 'cuboid') {
                this._points.length = 1;
            }
        } else if (this._mode == 'extend') {
            if (index == 0) {
                this._points = [loc, loc.offset(0, 0, 0)];
            } else {
                this._points[0] = Vector.min(this._points[0], this._points[1]).min(loc).toBlock();
                this._points[1] = Vector.max(this._points[0], this._points[1]).max(loc).toBlock();
            }
        }


        const [min, max] = [getWorldMinY(this.player), getWorldMaxY(this.player)];
        this._points.forEach(p => p.y = Math.min(Math.max(p.y, min), max));
        this.updateDrawSelection();
    }
    
    /**
    * Clears the selection points that have been made.
    */
    public clear() {
        this._points = [];
        this.updateDrawSelection();
    }
    
    /**
    * @return The blocks within the current selection
    */
    public *getBlocks() {
        let points = 0;
        for (const point of this._points) {
            if (point) points++;
        }
        if (points == 0 || points == 1)
            return;

        if (this.isCuboid()) {
            const min = Vector.min(this._points[0], this._points[1]);
            const max = Vector.max(this._points[0], this._points[1]);
            
            for (let z = min.z; z <= max.z; z++) {
                for (let y = min.y; y <= max.y; y++) {
                    for (let x = min.x; x <= max.x; x++) {
                        yield new BlockLocation(x, y, z);
                    }        
                }    
            }
        }
    }
    
    public getBlockCount() {
        let points = 0;
        for (const point of this._points) {
            if (point) points++;
        }
        if (points == 0 || points == 1)
            return 0;

        if (this.isCuboid()) {
            return regionVolume(this._points[0], this._points[1]);
        }
    }
    
    /**
    * @return The minimum and maximum points of the selection
    */
    public getRange(): [BlockLocation, BlockLocation] {
        if (this.isCuboid()) {
            const [pos1, pos2] = this._points.slice(0, 2);
            return regionBounds([pos1, pos2]);
        }
        return null;
    }
    
    /**
     * Get the shape of the current
     * @returns 
     */
    public getShape(): [Shape, BlockLocation] {
        if (this.isCuboid()) {
            const range = this.getRange();
            const size = Vector.sub(range[1], range[0]).add(1);
            return [new CuboidShape(size.x, size.y, size.z), range[0]];
        }
        return;
    }
    
    public isCuboid(): boolean {
        return this._mode == 'cuboid' || this._mode == 'extend';
    }

    public draw(): void {
        if (!this._visible) return;
        if (this.drawTimer <= 0) {
            this.drawTimer = 10;
            const dimension = this.player.dimension;
            for (const point of this.drawPoints) {
                Server.runCommand(`particle wedit:selection_draw ${point.print()}`, dimension);
            }
        }
        this.drawTimer--;
    }

    public get mode(): selectMode {
        return this._mode;
    }
    
    public set mode(value: selectMode) {
        this._mode = value;
    }
    
    public get points() {
        return this._points.slice();
    }
    
    public get visible(): boolean {
        return this._visible;
    }
    
    public set visible(value: boolean) {
        this._visible = value;
    }
    
    private updateDrawSelection() {
        this.drawPoints.length = 0;
        
        if (this.isCuboid()) {
            if (this._points.length != 2 || this._points[0] === undefined) {
                return;
            }
            const min = Vector.min(this._points[0], this._points[1]).add(Vector.ZERO);
            const max = Vector.max(this._points[0], this._points[1]).add(Vector.ONE);

            const corners = [
                new Vector(min.x, min.y, min.z),
                new Vector(max.x, min.y, min.z),
                new Vector(min.x, max.y, min.z),
                new Vector(max.x, max.y, min.z),
                new Vector(min.x, min.y, max.z),
                new Vector(max.x, min.y, max.z),
                new Vector(min.x, max.y, max.z),
                new Vector(max.x, max.y, max.z)
            ];

            const edgeData: [number, number][]= [
                [0, 1], [2, 3], [4, 5], [6, 7],
                [0, 2], [1, 3], [4, 6], [5, 7],
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];
            const edgePoints: Vector[] = [];
            for (const edge of edgeData) {
                const [a, b] = [corners[edge[0]], corners[edge[1]]];
                const pointCount = Math.min(Math.floor(b.sub(a).length), 16);
                for (let i = 1; i < pointCount; i++) {
                    let t = i / pointCount;
                    edgePoints.push(a.lerp(b, t));
                }
            }
            this.drawPoints = corners.concat(edgePoints);
        }
        
        // A slight offset is made since exact integers snap the particles to the center of blocks.
        for (const point of this.drawPoints) {
            point.x += 0.001;
            point.z += 0.001;
        }
        this.drawTimer = 0;
    }
    
}