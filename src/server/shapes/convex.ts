import { Vector3 } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { regionBounds, Vector } from "@notbeer-api";
import { isPointInsideHull, QuickHull } from "@modules/extern/quickhull3d/quickhull.js";

export class ConvexShape extends Shape {
    private faces: number[][];
    private points: Vector[];

    private min: Vector3;
    private max: Vector3;

    protected customHollow = true;

    constructor(points: Vector3[]) {
        super();
        this.points = points.map((p) => Vector.from(p));
        this.faces = new QuickHull(this.points).build().collectFaces(true);
        [this.min, this.max] = regionBounds(points);
    }

    public getRegion(loc: Vector) {
        return <[Vector, Vector]>[loc.add(this.min), loc.add(this.max)];
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
    }

    public getOutline() {
        const particles = [];
        for (const face of this.faces) {
            const points = face.map((i) => this.points[i].add(0.5));
            const edges = points.map((_, i) => [i, (i + 1) % points.length] as [number, number]);
            particles.push(...this.drawShape(points, edges));
        }
        return particles;
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.thickness = options?.hollowThickness ?? 1;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow && !isPointInsideHull(relLoc, this.points, this.faces, -1)) return false;
        return isPointInsideHull(relLoc, this.points, this.faces);
    }
}
