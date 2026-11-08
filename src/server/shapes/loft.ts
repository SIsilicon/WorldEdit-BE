import { Block, BlockVolume, Dimension, Vector3 } from "@minecraft/server";
import { Jobs } from "@modules/jobs.js";
import { Vector, VectorSet } from "@notbeer-api";
import { plotCurve, plotLine, plotTriangle, Spline, TensionVector } from "../commands/region/paths_func.js";
import { Shape } from "./base_shape.js";

type LoftSampler = {
    length: number;
    sample(t: number): Vector;
};

type LoftGenerationOptions = {
    lowPoly: boolean;
    outlineOnly: boolean;
    close: boolean;
    drop: boolean;
    count?: number;
    dropMinY?: number;
};

export class LoftShape extends Shape {
    protected customHollow = false;

    private curves: TensionVector[][] = [];

    private start = Vector.ZERO;
    private end = Vector.ZERO;

    private generationOptions: LoftGenerationOptions = {
        lowPoly: false,
        outlineOnly: false,
        close: false,
        drop: false,
    };

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
        if (!this.curves.length) {
            this.curves.push([]);
        }

        this.curves[this.curves.length - 1].push(TensionVector.from(point));

        this.updateParticles();
    }

    public removeLastPoint() {
        if (!this.curves.length) {
            return false;
        }

        this.curves[this.curves.length - 1].pop();

        if (!this.curves[this.curves.length - 1].length) {
            this.curves.pop();
        }

        this.updateParticles();

        return this.curves.length > 0;
    }

    public removeClosestPoint(point: Vector3) {
        if (!this.curves.length) {
            return false;
        }

        const target = Vector.from(point);

        let closestCurve = -1;
        let closestPoint = -1;
        let closestDistance = Infinity;

        for (let curveIndex = 0; curveIndex < this.curves.length; curveIndex++) {
            const curve = this.curves[curveIndex];

            for (let pointIndex = 0; pointIndex < curve.length; pointIndex++) {
                const distance = target.distanceTo(curve[pointIndex]);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCurve = curveIndex;
                    closestPoint = pointIndex;
                }
            }
        }

        if (closestCurve === -1) {
            return this.curves.length > 0;
        }

        this.curves[closestCurve].splice(closestPoint, 1);

        if (!this.curves[closestCurve].length) {
            this.curves.splice(closestCurve, 1);
        }

        this.updateParticles();

        return this.curves.length > 0;
    }

    public setGenerationOptions(options: Partial<LoftGenerationOptions>) {
        this.generationOptions = {
            lowPoly: false,
            outlineOnly: false,
            close: false,
            drop: false,
            ...options,
        };
    }

    public resetGenerationOptions() {
        this.generationOptions = {
            lowPoly: false,
            outlineOnly: false,
            close: false,
            drop: false,
        };
    }

    public getRegion(loc: Vector3): [Vector, Vector] {
        const start = this.start.add(loc);
        const end = this.end.add(loc);

        // Closed splines can curve slightly beyond their control points.
        if (this.generationOptions.close) {
            start.x -= 2;
            start.y -= 2;
            start.z -= 2;

            end.x += 2;
            end.y += 2;
            end.z += 2;
        }

        if (this.generationOptions.drop && this.generationOptions.dropMinY !== undefined) {
            start.y = Math.min(start.y, this.generationOptions.dropMinY);
        }

        return [start, end];
    }

    public getYRange(): [number, number] | void {
        throw new Error("Method not implemented.");
    }

    protected prepGeneration() {}

    protected *calculateShape(dimension: Dimension, _loc: Vector3, min: Vector3, max: Vector3): ReturnType<Shape["calculateShape"]> {
        const blocks = new VectorSet<Block>();
        const volume = new BlockVolume(min, max);

        function* addBlock(block: Vector3) {
            const location = Vector.from(block).floor();

            if (!volume.isInside(location) || blocks.has(location)) {
                return;
            }

            blocks.add(yield* Jobs.loadBlock(location));
        }

        function* addLine(a: Vector3, b: Vector3) {
            for (const block of plotLine(Vector.from(a).floor(), Vector.from(b).floor())) {
                yield* addBlock(block);
            }
        }

        const frameCurves = this.curves.map((curve) => this.createSampler(curve, this.generationOptions.lowPoly));

        const width = frameCurves.reduce((maxLength, curve) => Math.max(maxLength, curve.length), 0);

        const widthSamples = Math.max(Math.floor(width / 4) + 1, 1);

        let length = 0;

        const lengthCurves: LoftSampler[] = [];

        for (let i = 0; i <= widthSamples; i++) {
            const sample = i / widthSamples;

            const points = frameCurves.map((curve) => curve.sample(sample));

            const curve = this.createSampler(points, this.generationOptions.lowPoly);

            length = Math.max(length, curve.length);
            lengthCurves.push(curve);
        }

        const lengthSamples = Math.max(Math.floor(length / 4) + 1, 1);

        /*
         * Build the same 2D loft grid the old implementation
         * effectively used when triangulating the surface.
         *
         * grid[width][length]
         */
        const grid: Vector[][] = [];

        for (let i = 0; i <= widthSamples; i++) {
            const row: Vector[] = [];

            for (let j = 0; j <= lengthSamples; j++) {
                row.push(lengthCurves[i].sample(j / lengthSamples).add(0.5));

                yield Jobs.setProgress((j + i * (lengthSamples + 1)) / ((widthSamples + 1) * (lengthSamples + 1)));
            }

            grid.push(row);
        }

        /*
         * [count]
         *
         * Instead of filling every triangle, draw evenly
         * divided lines across both directions of the loft.
         */
        if (this.generationOptions.count !== undefined) {
            const divisions = Math.max(1, this.generationOptions.count);

            const widthIndices = LoftShape.getDivisionIndices(widthSamples, divisions);

            const lengthIndices = LoftShape.getDivisionIndices(lengthSamples, divisions);

            // Lines travelling between frames.
            for (const i of widthIndices) {
                for (let j = 1; j <= lengthSamples; j++) {
                    yield* addLine(grid[i][j - 1], grid[i][j]);
                }
            }

            // Close the last frame back to the first.
            if (this.generationOptions.close) {
                for (const i of widthIndices) {
                    yield* addLine(grid[i][lengthSamples], grid[i][0]);
                }
            }

            // Lines travelling across each frame.
            for (const j of lengthIndices) {
                for (let i = 1; i <= widthSamples; i++) {
                    yield* addLine(grid[i - 1][j], grid[i][j]);
                }
            }
        }

        /*
         * -o
         *
         * Generate only the outside boundary.
         */
        else if (this.generationOptions.outlineOnly) {
            const firstSide = grid[0];
            const lastSide = grid[grid.length - 1];

            // Two long outer edges.
            for (let j = 1; j < firstSide.length; j++) {
                yield* addLine(firstSide[j - 1], firstSide[j]);
            }

            for (let j = 1; j < lastSide.length; j++) {
                yield* addLine(lastSide[j - 1], lastSide[j]);
            }

            if (this.generationOptions.close) {
                // Close those two edges back onto themselves.
                if (firstSide.length > 1) {
                    yield* addLine(firstSide[firstSide.length - 1], firstSide[0]);
                }

                if (lastSide.length > 1) {
                    yield* addLine(lastSide[lastSide.length - 1], lastSide[0]);
                }
            } else {
                // First and last frame boundaries.
                for (let i = 1; i < grid.length; i++) {
                    yield* addLine(grid[i - 1][0], grid[i][0]);

                    const previous = grid[i - 1];
                    const current = grid[i];

                    yield* addLine(previous[previous.length - 1], current[current.length - 1]);
                }
            }
        }

        /*
         * Normal filled loft.
         */
        else {
            for (let i = 1; i <= widthSamples; i++) {
                for (let j = 1; j <= lengthSamples; j++) {
                    const a = grid[i - 1][j - 1];
                    const b = grid[i - 1][j];
                    const c = grid[i][j - 1];
                    const d = grid[i][j];

                    for (const block of plotTriangle(a, b, c)) {
                        yield* addBlock(block);
                    }

                    for (const block of plotTriangle(b, c, d)) {
                        yield* addBlock(block);
                    }
                }
            }

            // Connect the last frame back to the first frame.
            if (this.generationOptions.close && lengthSamples > 0) {
                for (let i = 1; i <= widthSamples; i++) {
                    const a = grid[i - 1][lengthSamples];
                    const b = grid[i - 1][0];
                    const c = grid[i][lengthSamples];
                    const d = grid[i][0];

                    for (const block of plotTriangle(a, b, c)) {
                        yield* addBlock(block);
                    }

                    for (const block of plotTriangle(b, c, d)) {
                        yield* addBlock(block);
                    }
                }
            }
        }

        /*
         * -d
         *
         * For every generated loft block, continue downward
         * through air until existing terrain is reached.
         */
        if (this.generationOptions.drop && this.generationOptions.dropMinY !== undefined) {
            const surfaceBlocks = Array.from(blocks);

            for (const surfaceBlock of surfaceBlocks) {
                for (let y = surfaceBlock.y - 1; y >= this.generationOptions.dropMinY; y--) {
                    const location = {
                        x: surfaceBlock.x,
                        y,
                        z: surfaceBlock.z,
                    };

                    const block = yield* Jobs.loadBlock(location);

                    if (!block.isAir) {
                        break;
                    }

                    blocks.add(block);

                    yield;
                }
            }
        }

        return [blocks, blocks.size];
    }

    public getOutline() {
        this.start = new Vector(Infinity, Infinity, Infinity);

        this.end = new Vector(-Infinity, -Infinity, -Infinity);

        const particles = [];

        const maxCurvePoints = this.curves.reduce((max, curve) => Math.max(max, curve.length), 0);

        const curveSamples = this.curves.map((curve) =>
            Array.from(
                plotCurve(curve, {
                    precision: 2,
                    plotLines: false,
                })
            )
        );

        for (const curve of curveSamples) {
            particles.push(
                ...this.drawLine(
                    curve.map((point) => point.add(0.5)),
                    false,
                    true
                )
            );
        }

        if (curveSamples.length > 1) {
            for (let i = 0; i < maxCurvePoints; i++) {
                particles.push(
                    ...this.drawLine(
                        Array.from(
                            plotCurve(
                                curveSamples.map((curve) => LoftShape.sampleCurve(curve, i / Math.max(maxCurvePoints - 1, 1))),
                                {
                                    precision: 2,
                                    plotLines: false,
                                }
                            )
                        ).map((point) => point.add(0.5)),
                        false,
                        true
                    )
                );
            }
        }

        for (const [, loc] of particles) {
            this.start = this.start.min(loc);
            this.end = this.end.max(loc);
        }

        return particles;
    }

    private updateParticles() {
        this.outlineCache = this.getOutline();
    }

    /*
     * Creates either the normal smooth Spline or the -p
     * piecewise-linear version.
     */
    private createSampler(points: Vector3[], lowPoly: boolean): LoftSampler {
        const curve = points.map((point) => Vector.from(point));

        if (!curve.length) {
            return {
                length: 0,
                sample: () => Vector.ZERO,
            };
        }

        if (curve.length === 1) {
            return {
                length: 0,
                sample: () => curve[0].clone(),
            };
        }

        if (!lowPoly) {
            const spline = new Spline(curve.map((point) => TensionVector.from(point)));

            return {
                length: spline.length,
                sample: (t) => Vector.from(spline.sample(t)),
            };
        }

        /*
         * -p:
         * piecewise linear interpolation following the
         * distances between control points.
         */
        const totalLength = curve.reduce((length, point, index) => {
            if (index === 0) return 0;

            return length + Vector.sub(point, curve[index - 1]).length;
        }, 0);

        const segmentCount = curve.length - 1;

        return {
            length: totalLength,

            sample: (t: number) => {
                if (t <= 0) {
                    return curve[0].clone();
                }

                if (t >= 1) {
                    return curve[curve.length - 1].clone();
                }

                const scaled = t * segmentCount;
                const index = Math.min(Math.floor(scaled), segmentCount - 1);
                const progress = scaled - index;

                const start = curve[index];
                const end = curve[index + 1];

                return start.lerp(end, progress);
            },
        };
    }

    private static getDivisionIndices(maxIndex: number, divisions: number) {
        const indices = new Set<number>();

        for (let i = 0; i <= divisions; i++) {
            indices.add(Math.round((i / divisions) * maxIndex));
        }

        return [...indices].sort((a, b) => a - b);
    }

    private static sampleCurve(curveSamples: Vector3[], t: number): Vector3 {
        const n = curveSamples.length - 1;
        const i = Math.floor(t * n);
        const u = t * n - i;

        if (i >= n) {
            return curveSamples[n];
        }

        const p0 = curveSamples[i];
        const p1 = curveSamples[i + 1];

        return Vector.from(p0).lerp(p1, u);
    }
}
