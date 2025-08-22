import { Vector3 } from "@minecraft/server";
import { regionBounds, regionIterateBlocks, Vector, VectorSet } from "@notbeer-api";

export function* plotTriangle(a: Vector3, b: Vector3, c: Vector3) {
    // Convert to Vector for easier math
    const va = Vector.from(a);
    const vb = Vector.from(b);
    const vc = Vector.from(c);
    // Edges
    const f0 = vb.sub(va);
    const f1 = vc.sub(vb);
    const f2 = va.sub(vc);

    const axes = [
        f0.cross(f1), // triangle normal
        new Vector(1, 0, 0),
        new Vector(0, 1, 0),
        new Vector(0, 0, 1), // box face normals
        f0.cross([1, 0, 0]),
        f0.cross([0, 1, 0]),
        f0.cross([0, 0, 1]),
        f1.cross([1, 0, 0]),
        f1.cross([0, 1, 0]),
        f1.cross([0, 0, 1]),
        f2.cross([1, 0, 0]),
        f2.cross([0, 1, 0]),
        f2.cross([0, 0, 1]),
    ];

    function triangleBlockIntersect(block: Vector3) {
        const boxCenter = Vector.add(block, 0.5);
        const boxHalfSize = new Vector(0.5, 0.5, 0.5);
        const [v0, v1, v2] = [va, vb, vc].map((v) => v.sub(boxCenter));
        for (const axis of axes) if (!overlapOnAxis(axis, v0, v1, v2, boxHalfSize)) return false;
        return true;
    }

    function overlapOnAxis(axis: Vector3, v0: Vector, v1: Vector, v2: Vector, boxHalfSize: Vector3) {
        const p0 = v0.dot(axis);
        const p1 = v1.dot(axis);
        const p2 = v2.dot(axis);

        const minP = Math.min(p0, p1, p2);
        const maxP = Math.max(p0, p1, p2);

        const r = boxHalfSize.x * Math.abs(axis.x) + boxHalfSize.y * Math.abs(axis.y) + boxHalfSize.z * Math.abs(axis.z);

        return !(minP > r || maxP < -r);
    }

    const blocks = new VectorSet<Vector>();
    for (const block of regionIterateBlocks(...regionBounds([va, vb, vc].map((v) => v.floor())))) {
        if (triangleBlockIntersect(block)) yield block;
    }
    return blocks;
}

export function* plotLine(pos1: Vector3, pos2: Vector3) {
    const delta = Vector.sub(pos2, pos1);
    const increment = delta.map(Math.sign);
    const absDelta = delta.abs();
    const absDelta2 = absDelta.mul(2);
    const maxIndex = absDelta.largestAxis();
    const error = absDelta2.sub(absDelta[maxIndex]);

    const current = Vector.from(pos1);
    const result = new VectorSet<Vector>();
    for (let j = 0; j < absDelta[maxIndex]; j++) {
        result.add(current);
        yield current.clone();
        for (const axis of Vector.AXES) {
            if (error[axis] > 0) {
                current[axis] += increment[axis];
                error[axis] -= absDelta2[maxIndex];
            }
            error[axis] += absDelta2[axis];
        }
    }
    result.add(current);
    yield current.clone();
    return result;
}

export function* plotCurve(points: Vector3[], options?: { precision?: number; plotLines?: boolean }) {
    return yield* new Spline(points.map((p) => TensionVector.from(p))).plotCurve(options?.plotLines ?? true, options?.precision ?? 4);
}

export function* balloonPath(points: Iterable<Vector3>, radius: number) {
    const ballooned = new VectorSet<Vector>();
    for (const point of points) {
        const center = Vector.from(point);
        for (const block of regionIterateBlocks(Vector.sub(point, radius), Vector.add(point, radius))) {
            if (center.distanceTo(block) >= radius + 0.5 || ballooned.has(block)) continue;
            const blockVec = Vector.from(block);
            ballooned.add(blockVec);
            yield blockVec;
        }
    }
    return ballooned;
}

/**
 * @name TensionVector
 * @description An extension of an N-dimensional vector to include Tension, Continuity, and Bias, as required by cubic Hermite splines.
 * @author Spike Burton
 * @author Allen Woods
 **/
export class TensionVector extends Vector {
    private tParam: number;
    private cParam: number;
    private bParam: number;

    static from(vector: Vector3, t = 0, c = 0, b = 0) {
        return new TensionVector(vector.x, vector.y, vector.z, t, c, b);
    }

    constructor(x: number, y: number, z: number, t: number, c: number, b: number) {
        super(x, y, z);

        this.t = t;
        this.c = c;
        this.b = b;
    }

    // Tension
    get t() {
        return this.tParam;
    }
    set t(tValue) {
        this.tParam = tValue < 0 ? 0 : tValue > 1 ? 1 : tValue;
    }

    // Continuity
    get c() {
        return this.cParam;
    }
    set c(cValue) {
        this.cParam = cValue < 0 ? 0 : cValue > 1 ? 1 : cValue;
    }

    // Bias
    get b() {
        return this.bParam;
    }
    set b(bValue) {
        this.bParam = bValue < 0 ? 0 : bValue > 1 ? 1 : bValue;
    }
}

/**
 * @name Spline
 * @description An implementation of Kochanek-Bartels splines in three dimensions. (MODIFIED)
 * @author Allen Woods
 **/
export class Spline {
    private knots: TensionVector[] = [];
    private internalKnots: TensionVector[] = [];
    private hypotenuseSum = 0;

    constructor(knotVectorData: TensionVector[]) {
        this.knots = [...knotVectorData];
        this.update();
    }

    sample(t: number) {
        // If t is out of bounds, return the first or last knot
        if (t <= 0) return this.knots[0];
        if (t >= 1) return this.knots[this.knots.length - 1];

        // Calculate the hypotenuse sum to find the correct segment
        const x = t * this.hypotenuseSum;
        const interval = this.arbitraryInterval(x);
        if (typeof interval !== "object" || isNaN(interval.t)) return this.knots[0];

        // Calculate the position on the curve using the segment and t value
        return this.calcPosition(interval.t, interval.k);
    }

    // Update internal state of spline. Call when knots change.
    update() {
        // The math of this curve requires specific point locations. So...
        // Prepend a duplicate of the first point before the start of the curve
        // And append duplicates of the last point after the end of the curve
        this.internalKnots = [this.knots[0], ...this.knots, this.knots[this.knots.length - 1], this.knots[this.knots.length - 1]];

        this.hypotenuseSum = 0;
        for (let k = 1; k < this.internalKnots.length - 1; k++) this.hypotenuseSum += this.hypotenuseAtKnot(k);
    }

    get length() {
        return this.hypotenuseSum;
    }

    /* Helper methods for adding points */

    prependKnot(vector: TensionVector) {
        this.knots.unshift(vector);
        this.update();
    }

    appendKnot(vector: TensionVector) {
        this.knots.push(vector);
        this.update();
    }

    /* Helper methods for accessing points */

    firstKnot() {
        return this.knots[0];
    }

    lastKnot() {
        return this.knots[this.knots.length - 1];
    }

    nthKnot(idx: number) {
        return this.knots[idx];
    }

    seriesOfKnots(startIdx: number, endIdx: number) {
        if (Math.sign(startIdx) === -1 || Math.sign(endIdx) === -1) return;
        return this.knots.slice(startIdx, endIdx + 1);
    }

    /* Hermite basis functions */

    private h0(t: number) {
        return (1 + 2 * t) * ((1 - t) * (1 - t));
    }
    private h1(t: number) {
        return t * ((1 - t) * (1 - t));
    }
    private h2(t: number) {
        return t * t * (3 - 2 * t);
    }
    private h3(t: number) {
        return t * t * (t - 1);
    }

    // This function calculates a hypotenuse between the given point and the next point forward
    private hypotenuseAtKnot(knotNumber: number) {
        const v1 = this.internalKnots[knotNumber];
        const v2 = this.internalKnots[knotNumber + 1];
        return Vector.sub(v1, v2).length;
    }

    // This function receives a value of "x" and calculates a "t" value based on its progression
    // within the hypotenuse yielded by the preceding point and the next nearest point.
    private arbitraryInterval(x: number) {
        const hyps = [];
        const sum = this.hypotenuseSum;

        for (let k = 1; k < this.internalKnots.length - 1; k++) {
            const hyp = { x: 0, l: this.hypotenuseAtKnot(k) };
            if (hyps.length > 0) hyp.x = hyps[hyps.length - 1].x + hyps[hyps.length - 1].l;
            hyps.push(hyp);
        }

        let lastNearestKnot = 0;

        if (x < 0) return 0;
        else if (x > sum) return 1;

        let t = 0;
        for (let h = 0; h < hyps.length; h++) {
            if (x >= hyps[h].x && x <= hyps[h].x + hyps[h].l) {
                t = (x - hyps[h].x) / hyps[h].l;
                lastNearestKnot = h + 1;
                break;
            }
        }
        return { t: t, k: lastNearestKnot };
    }

    // Kochanek-Bartels functions //

    // We pass in the index "i" that is the starting point for the piece we are drawing.
    private d(i: number) {
        // create an empty array to fill with calculations
        const tangentsArray = [];

        // get the points at indexes "i-1", "i", "i+1", and "i+2"
        const ptm1 = this.internalKnots[i - 1];
        const pt0 = this.internalKnots[i];
        const ptp1 = this.internalKnots[i + 1];
        const ptp2 = this.internalKnots[i + 2];

        // For each of the two tangents we need
        for (let j = 0; j < 2; j++) {
            // Create an empty temporary object
            const tempTangent = new TensionVector(0, 0, 0, 0, 0, 0);

            let f0 = 0;
            let f1 = 0;
            let delta0;
            let delta1;

            // If this is the first tangent
            if (j === 0) {
                // Calculate the fractions for tension, continuity, and bias on this point
                f0 = (1 - pt0.t) * (1 + pt0.b) * (1 + pt0.c) * 0.5;
                f1 = (1 - pt0.t) * (1 - pt0.b) * (1 - pt0.c) * 0.5;
                // store pointers to the points whose distances are measured
                delta0 = { p0: pt0, p1: ptm1 };
                delta1 = { p0: ptp1, p1: pt0 };
            } else {
                // Calculate the fractions for tension, continuity, and bias on the next point
                f0 = (1 - ptp1.t) * (1 + ptp1.b) * (1 - ptp1.c) * 0.5;
                f1 = (1 - ptp1.t) * (1 - ptp1.b) * (1 + ptp1.c) * 0.5;
                // store pointers to the points whose distances are measured
                delta0 = { p0: ptp1, p1: pt0 };
                delta1 = { p0: ptp2, p1: ptp1 };
            }

            // for each axis of "x", "y", and "z"
            for (let k = 0; k < 3; k++) {
                // Calculate first and second terms of the equation on this tangent
                const term0 = f0 * (delta0.p0.getIdx(k) - delta0.p1.getIdx(k));
                const term1 = f1 * (delta1.p0.getIdx(k) - delta1.p1.getIdx(k));
                // Assign the addition of the terms to the axis of the tangent
                tempTangent.setIdx(k, term0 + term1);
            }

            // store the resulting object
            tangentsArray.push(tempTangent);
        }

        // return the two calculated tangents
        return tangentsArray;
    }

    private calcPosition(t: number, k: number) {
        // Create a null object to store calculations in
        const positionObject = new TensionVector(0, 0, 0, 0, 0, 0);

        // Create pointers to the start and end points of this piece
        const pt0 = this.internalKnots[k];
        const pt1 = this.internalKnots[k + 1];

        // Create local pointer to the tangents for this piece
        const dTan = this.d(k);

        // For each axis of this curve
        for (let n = 0; n < 3; n++) {
            // Calculate the terms of the interpolation polynomial
            const term0 = this.h0(t) * pt0.getIdx(n);
            const term1 = this.h1(t) * dTan[0].getIdx(n);
            const term2 = this.h2(t) * pt1.getIdx(n);
            const term3 = this.h3(t) * dTan[1].getIdx(n);
            // Store the point location in the gixen axis
            positionObject.setIdx(n, term0 + term1 + term2 + term3);
        }

        // Return the resulting location in space
        return positionObject;
    }

    *plotCurve(plotLines = true, precision = 4) {
        const blocks = new VectorSet<Vector>();

        // Prevent drawing altogether if there aren't enough points to draw a line
        if (this.knots.length < 1) return blocks;
        // If there is only one point, plot it and return
        if (this.knots.length < 2) {
            const loc = Vector.from(this.knots[0]);
            yield loc;
            return blocks.add(loc);
        }

        let lastPosition = new Vector(0, 0, 0);

        const hypotSum = this.hypotenuseSum;
        for (let x = 0; x < hypotSum; x += precision) {
            const t = this.arbitraryInterval(x);
            if (typeof t === "object" && !isNaN(t.t)) {
                const curveTraceVector = this.calcPosition(t.t, t.k);
                const drawPosition = curveTraceVector.add(0.5).floor();
                if (!plotLines) {
                    if (!blocks.has(curveTraceVector)) {
                        blocks.add(curveTraceVector);
                        yield curveTraceVector;
                    }
                } else if (t.t !== 0) {
                    for (const loc of plotLine(lastPosition, drawPosition)) {
                        if (blocks.has(loc)) continue;
                        blocks.add(loc);
                        yield loc;
                    }
                }
                lastPosition = drawPosition;
            }
        }
        // Make sure the end is plotted
        const t = this.arbitraryInterval(hypotSum);
        if (typeof t === "object" && !isNaN(t.t)) {
            const curveTraceVector = this.calcPosition(t.t, t.k);
            const drawPosition = curveTraceVector.add(0.5).floor();
            if (!plotLines) {
                if (!blocks.has(curveTraceVector)) {
                    blocks.add(curveTraceVector);
                    yield curveTraceVector;
                }
            } else if (!lastPosition.floor().equals(drawPosition.floor())) {
                for (const loc of plotLine(lastPosition, drawPosition)) {
                    if (blocks.has(loc)) continue;
                    blocks.add(loc);
                    yield loc;
                }
            }
        }

        return blocks;
    }
}
