import { Block, BlockVolume, Dimension, Vector3 } from "@minecraft/server";
import { Shape } from "./base_shape";
import { Vector, VectorSet } from "@notbeer-api";
import { plotCurve, plotTriangle, Spline, TensionVector } from "server/commands/region/paths_func";
import { Jobs } from "@modules/jobs";

export class LoftShape extends Shape {
    protected customHollow = false;

    private curves: TensionVector[][] = [];

    private start = Vector.ZERO;
    private end = Vector.ZERO;

    constructor(curves: Vector3[][] = []) {
        super();
        this.curves = curves.map((curve) => curve.map((point) => TensionVector.from(point)));
        this.updateParticles();
    }

    public newCurve(point: Vector3) {
        this.curves.push([TensionVector.from(point)]);
        this.updateParticles();
    }

    public addPoint(point: Vector3) {
        if (!this.curves.length) this.curves.push([]);
        this.curves[this.curves.length - 1].push(TensionVector.from(point));
        this.updateParticles();
    }

    public removeLastPoint() {
        if (!this.curves.length) return false;
        this.curves[this.curves.length - 1].pop();
        if (!this.curves[this.curves.length - 1].length) this.curves.pop();
        this.updateParticles();
        return this.curves.length > 0;
    }

    public getRegion(loc: Vector3): [Vector, Vector] {
        return [this.start.add(loc), this.end.add(loc)];
    }

    public getYRange(): [number, number] | void {
        throw new Error("Method not implemented.");
    }

    protected prepGeneration() {}

    protected *calculateShape(dimension: Dimension, _loc: Vector3, min: Vector3, max: Vector3): ReturnType<Shape["calculateShape"]> {
        const blocks = new VectorSet<Block>();
        const volume = new BlockVolume(min, max);

        function* addBlock(block: Vector3) {
            if (volume.isInside(block)) blocks.add(dimension.getBlock(block) ?? (yield* Jobs.loadBlock(block)));
        }

        const curves = this.curves.map((curve) => new Spline(curve));
        const width = curves.reduce((max, curve) => Math.max(max, curve.length), 0);
        const widthSamples = Math.floor(width / 8) + 1;
        let length = 0;
        const lengthCurves = [];
        for (let i = 0; i <= widthSamples; i++) {
            const curve = new Spline(curves.map((curve) => curve.sample(i / widthSamples)));
            length = Math.max(length, curve.length);
            lengthCurves.push(curve);
        }

        const lengthSamples = Math.floor(length / 8) + 1;
        for (let i = 1; i < lengthCurves.length; i++) {
            const curveA = lengthCurves[i - 1];
            const curveB = lengthCurves[i];

            let startA = curveA.sample(0).add(0.5);
            let startB = curveB.sample(0).add(0.5);
            for (let j = 1; j <= lengthSamples; j++) {
                const sample = j / lengthSamples;
                const endA = curveA.sample(sample).add(0.5);
                const endB = curveB.sample(sample).add(0.5);

                for (const block of plotTriangle(startA, endA, startB)) {
                    if (!blocks.has(block)) yield* addBlock(block);
                    else yield;
                }
                for (const block of plotTriangle(endA, startB, endB)) {
                    if (!blocks.has(block)) yield* addBlock(block);
                    else yield;
                }

                startA = endA;
                startB = endB;
            }
        }

        return [blocks, blocks.size];
    }

    public getOutline() {
        this.start = new Vector(Infinity, Infinity, Infinity);
        this.end = new Vector(-Infinity, -Infinity, -Infinity);
        const particles = [];

        const maxCurvePoints = this.curves.reduce((max, curve) => Math.max(max, curve.length), 0);
        const curveSamples = this.curves.map((curve) => Array.from(plotCurve(curve, { precision: 2, plotLines: false })));

        for (const curve of curveSamples)
            particles.push(
                ...this.drawLine(
                    curve.map((point) => point.add(0.5)),
                    false,
                    true
                )
            );
        if (curveSamples.length > 1)
            for (let i = 0; i < maxCurvePoints; i++)
                particles.push(
                    ...this.drawLine(
                        Array.from(
                            plotCurve(
                                curveSamples.map((c) => LoftShape.sampleCurve(c, i / (maxCurvePoints - 1))),
                                { precision: 2, plotLines: false }
                            )
                        ).map((point) => point.add(0.5)),
                        false,
                        true
                    )
                );

        for (const [, loc] of particles) {
            this.start = this.start.min(loc);
            this.end = this.end.max(loc);
        }

        return particles;
    }

    private updateParticles() {
        this.outlineCache = this.getOutline();
    }

    private static sampleCurve(curveSamples: Vector3[], t: number): Vector3 {
        const n = curveSamples.length - 1;
        const i = Math.floor(t * n);
        const u = t * n - i;

        if (i >= n) return curveSamples[n];

        const p0 = curveSamples[i];
        const p1 = curveSamples[i + 1];

        return Vector.from(p0).lerp(p1, u);
    }
}
