import { BlockVolumeBase } from "@minecraft/server";
import { Shape } from "server/shapes/base_shape.js";
import { Vector } from "@notbeer-api";

export class VolumeShape extends Shape {
    private volume: BlockVolumeBase;
    protected customHollow = false;

    constructor(volume: BlockVolumeBase) {
        super();
        this.volume = volume;
    }

    public getRegion(loc: Vector): [Vector, Vector] {
        const min = Vector.from(this.volume.getMin()).add(loc);
        const max = Vector.from(this.volume.getMax()).add(loc);
        return [min, max];
    }

    public getYRange(): [number, number] | void {
        throw new Error("Method not implemented.");
    }

    protected prepGeneration() {}

    protected getOutline(): [string, Vector][] {
        const min = Vector.from(this.volume.getMin());
        const max = Vector.from(this.volume.getMax()).add(1);

        const vertices = [
            new Vector(min.x, min.y, min.z),
            new Vector(max.x, min.y, min.z),
            new Vector(min.x, max.y, min.z),
            new Vector(max.x, max.y, min.z),
            new Vector(min.x, min.y, max.z),
            new Vector(max.x, min.y, max.z),
            new Vector(min.x, max.y, max.z),
            new Vector(max.x, max.y, max.z),
        ];
        const edges: [number, number][] = [
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
            [0, 2],
            [1, 3],
            [4, 6],
            [5, 7],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ];
        return this.drawShape(vertices, edges);
    }

    protected inShape(relLoc: Vector): boolean {
        return this.volume.isInside(relLoc);
    }
}
