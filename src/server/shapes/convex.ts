import { Player, Vector3 } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { regionBounds, regionSize, Vector } from "@notbeer-api";
import { isPointInsideHull, isPointInsideHull2D, QuickHull } from "@modules/extern/quickhull3d/quickhull.js";
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
        [this.min, this.max] = regionBounds(this.points);
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
            this.curveParticles = this.drawLine(points);
        }

        for (const face of this.faces) {
            const points = face.map((i) => this.points[i].add(0.5));
            particles.push(...this.drawLine(points, true));
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

        const [min, max] = regionBounds(this.points);
        const size = regionSize(min, max);
        const points = this.points.map((p) => p.sub(min).div(size.sub(1).max(Vector.ONE)).mul(size).add(min));

        let is3d = false;
        const firstNormal = Vector.sub(points[this.faces[0][2]], points[this.faces[0][0]]).cross(Vector.sub(points[this.faces[0][1]], points[this.faces[0][0]])).normalized();
        for (let i = 1; i < this.faces.length; i++) {
            const otherNormal = Vector.sub(points[this.faces[i][2]], points[this.faces[i][0]]).cross(Vector.sub(points[this.faces[i][1]], points[this.faces[i][0]])).normalized();
            if (!otherNormal.equals(firstNormal)) {
                is3d = true;
                break;
            }
        }

        if (is3d) {
            genVars.calculateShape = (relLoc: Vector, tolerance?: number) => {
                return isPointInsideHull(relLoc, points, this.faces, tolerance);
            };
        } else {
            // compute plane normal
            const a = points[this.faces[0][0]];
            const b = points[this.faces[0][1]];
            const c = points[this.faces[0][2]];
            const planeNormal = Vector.sub(b, a).cross(Vector.sub(c, a)).normalized();

            // choose u, v
            const u = b.sub(a);
            const vVec = planeNormal.cross(u);
            const uNorm = u.normalized();
            const vNorm = vVec.normalized();

            // project points
            const projectedPoints: Vector[] = points.map((p) => {
                const proj = p.sub(a);
                const x = proj.dot(uNorm);
                const y = proj.dot(vNorm);
                return new Vector(x, y, 0); // z=0
            });

            // compute edges
            const edgeCount = new Map<string, number>();
            for (const face of this.faces) {
                for (let i = 0; i < face.length; i++) {
                    const ia = face[i];
                    const ib = face[(i + 1) % face.length];
                    const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`;
                    edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
                }
            }
            const edges: [number, number][] = [];
            for (const [key, count] of edgeCount) {
                if (count !== 1) continue;
                const [ia, ib] = key.split("-").map(Number);
                edges.push([ia, ib]);
            }

            genVars.calculateShape = (relLoc: Vector, tolerance?: number) => {
                // project relLoc
                const projLoc = relLoc.sub(a);
                const px = projLoc.dot(uNorm);
                const py = projLoc.dot(vNorm);
                const point2d = new Vector(px, py, 0);
                return isPointInsideHull2D(point2d, projectedPoints, edges, tolerance);
            };
        }
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow && !genVars.calculateShape(relLoc, -genVars.thickness)) return false;
        return genVars.calculateShape(relLoc);
    }
}
