import { regionBounds, regionVolume, Vector } from "@notbeer-api";
import { MolangVariableMap, Player, system } from "@minecraft/server";
import { Shape } from "../shapes/base_shape.js";
import { SphereShape } from "../shapes/sphere.js";
import { CuboidShape } from "../shapes/cuboid.js";
import { CylinderShape } from "../shapes/cylinder.js";
import { arraysEqual, getWorldHeightLimits, snap } from "../util.js";
import config from "config.js";

// TODO: Add other selection modes
export const selectionModes = ["cuboid", "extend", "sphere", "cylinder"] as const;
export type selectMode = typeof selectionModes[number];

const drawFrequency = 8; // in ticks

export class Selection {
  private _mode: selectMode = "cuboid";
  private _points: Vector[] = [];
  private _visible: boolean = config.drawOutlines;

  private modeLastDraw: selectMode = this._mode;
  private pointsLastDraw: Vector[] = [];

  private player: Player;
  private drawPoints: Vector[] = [];
  private lastDraw = 0;

  constructor(player: Player) {
    this.player = player;
  }

  /**
   * Sets either the first or second selection point of a selection.
   * @param index The first or second selection point
   * @param loc The location the selection point is being made
   */
  public set(index: 0|1, loc: Vector): void {
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
    this._points.forEach(p => p.y = Math.min(Math.max(p.y, min), max));
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
    if (!this.isValid()) return null;

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
  public* getBlocks() {
    if (!this.isValid()) return;

    const [shape, loc] = this.getShape();
    yield* shape.getBlocks(loc);
  }

  /**
   * Returns the exact or approximate number of blocks the selection encompasses.
   * @returns
   */
  public getBlockCount() {
    if (!this.isValid()) return 0;

    if (this.isCuboid()) {
      return regionVolume(this._points[0], this._points[1]);
    } else if (this._mode == "sphere") {
      const radius = Vector.sub(this._points[1], this._points[0]).length;
      return Math.round((4/3) * Math.PI * Math.pow(radius, 3));
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

  public isValid() {
    let points = 0;
    for (const point of this._points) {
      if (point) points++;
    }
    return points != 0 && points != 1;
  }

  public draw(): void {
    if (!this._visible) return;
    if (system.currentTick > this.lastDraw + drawFrequency) {
      if (this._mode != this.modeLastDraw || !arraysEqual(this._points, this.pointsLastDraw, (a, b) => a.equals(b))) {
        this.updatePoints();
        this.modeLastDraw = this._mode;
        this.pointsLastDraw = this.points;
      }
      const dimension = this.player.dimension;
      for (const point of this.drawPoints) {
        try {
          dimension.spawnParticle("wedit:selection_draw", point, new MolangVariableMap());
        } catch { /* pass */ }
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
    return this._points.map(v => v.clone());
  }

  public get visible(): boolean {
    return this._visible;
  }

  public set visible(value: boolean) {
    this._visible = value;
  }

  private updatePoints() {
    this.drawPoints.length = 0;
    if (!this.isValid()) return;

    if (this.isCuboid()) {
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
        const resolution = Math.min(Math.floor(b.sub(a).length), 16);
        for (let i = 1; i < resolution; i++) {
          const t = i / resolution;
          edgePoints.push(a.lerp(b, t));
        }
      }
      this.drawPoints = corners.concat(edgePoints);
    } else if (this._mode == "sphere") {
      const axes: [typeof Vector.prototype.rotateX, Vector][] = [
        [Vector.prototype.rotateX, new Vector(0, 1, 0)],
        [Vector.prototype.rotateY, new Vector(1, 0, 0)],
        [Vector.prototype.rotateZ, new Vector(0, 1, 0)]
      ];
      const loc = this._points[0];
      const radius = Vector.sub(this._points[1], loc).length + 0.5;
      const resolution = snap(Math.min(radius * 2*Math.PI, 36), 4);

      for (const [rotateBy, vec] of axes) {
        for (let i = 0; i < resolution; i++) {
          let point: Vector = rotateBy.call(vec, i / resolution * 360);
          point = point.mul(radius).add(loc).add(0.5);
          this.drawPoints.push(point);
        }
      }
    } else if (this._mode == "cylinder") {
      const offset = new Vector(0.5, 0, 0.5);
      const [pointA, pointB] = [this._points[0], this._points[1]];

      const diff = Vector.sub(pointB, pointA);
      const radius = diff.mul([1, 0, 1]).length + 0.5;
      const height = Math.abs(diff.y) + 1;

      const resolution = snap(Math.min(radius * 2*Math.PI, 36), 4);
      const vec = new Vector(1, 0, 0);

      for (let i = 0; i < resolution; i++) {
        let point = vec.rotateY(i / resolution * 360);
        point = point.mul(radius).add(pointA).add(offset);
        this.drawPoints.push(point);
        this.drawPoints.push(point.add([0, height, 0]));
      }

      const corners = [
        new Vector(1, 0, 0), new Vector(-1, 0, 0),
        new Vector(0, 0, 1), new Vector(0, 0, -1)
      ];
      for (const corner of corners) {
        const [a, b] = [
          corner.mul(radius).add(pointA).add(offset),
          corner.mul(radius).add(pointA).add(offset).add([0, height, 0])
        ];
        const resolution = Math.min(Math.floor(b.sub(a).length), 16);
        for (let i = 1; i < resolution; i++) {
          const t = i / resolution;
          this.drawPoints.push(a.lerp(b, t));
        }
      }
    }
  }
}