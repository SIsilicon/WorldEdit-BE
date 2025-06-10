import { Player, Vector3 } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { regionBounds, Vector } from "@notbeer-api";
import { isPointInsideHull, QuickHull } from "@modules/extern/quickhull3d/quickhull.js";
import { plotCurve } from "server/commands/region/paths_func.js";

export class ConvexShape extends Shape {
    private faces: number[][];
    private points: Vector[];

    private min: Vector3;
    private max: Vector3;

    private curveTick = 0;
    private curveParticles: [string, Vector][] = [];

    protected customHollow = true;

    public drawCurve = false;

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

        if (this.drawCurve) {
            const points = Array.from(plotCurve(this.points))
                .filter((_, i) => i % 3 === 0)
                .map((p) => Vector.from(p).add(0.5));
            const edges = points.map((_, i) => [i, i + 1] as [number, number]);
            edges.pop(); // Remove last edge to avoid connecting the last point to the first
            this.curveParticles = this.drawShape(points, edges);
        }

        for (const face of this.faces) {
            const points = face.map((i) => this.points[i].add(0.5));
            const edges = points.map((_, i) => [i, (i + 1) % points.length] as [number, number]);
            particles.push(...this.drawShape(points, edges));
        }

        return particles;
    }

    public draw(player: Player, loc: Vector3) {
        const temp = this.outlineCache;
        if (this.curveTick > 3 && this.curveParticles.length) this.outlineCache = this.curveParticles;

        super.draw(player, loc);

        this.curveTick = (this.curveTick + 1) % 8;
        this.outlineCache = temp ?? this.outlineCache;
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
