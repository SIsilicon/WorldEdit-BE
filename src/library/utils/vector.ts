import { Direction, Vector3 } from "@minecraft/server";
import { Matrix } from "./matrix";

type anyVec = Vector3 | [number, number, number] | Direction;

export type axis = "x" | "y" | "z";

const DIRECTION_VECTORS: Record<Direction, [number, number, number]> = {
    [Direction.Up]: [0, 1, 0],
    [Direction.Down]: [0, -1, 0],
    [Direction.North]: [0, 0, -1],
    [Direction.South]: [0, 0, 1],
    [Direction.East]: [1, 0, 0],
    [Direction.West]: [-1, 0, 0],
};

export class Vector {
    private vals: [number, number, number] = [0, 0, 0];

    static get AXES(): [axis, axis, axis] {
        return ["x", "y", "z"];
    }

    static get ZERO() {
        return new Vector(0, 0, 0);
    }
    static get ONE() {
        return new Vector(1, 1, 1);
    }
    static get UP() {
        return new Vector(0, 1, 0);
    }
    static get DOWN() {
        return new Vector(0, -1, 0);
    }
    static get INF() {
        return new Vector(Infinity, Infinity, Infinity);
    }
    static get NEG_INF() {
        return new Vector(-Infinity, -Infinity, -Infinity);
    }

    static from(loc: anyVec) {
        if (Array.isArray(loc)) return new Vector(...loc);
        else if (typeof loc === "string") return new Vector(...DIRECTION_VECTORS[loc]);
        return new Vector(loc.x, loc.y, loc.z);
    }

    static add(a: anyVec, b: anyVec | number) {
        return Vector.from(a).add(b);
    }

    static sub(a: anyVec, b: anyVec | number) {
        return Vector.from(a).sub(b);
    }

    static mul(a: anyVec, b: anyVec | number) {
        return Vector.from(a).mul(b);
    }

    static div(a: anyVec, b: anyVec | number) {
        return Vector.from(a).div(b);
    }

    static min(a: anyVec, b: anyVec) {
        return Vector.from(a).min(b);
    }

    static max(a: anyVec, b: anyVec) {
        return Vector.from(a).max(b);
    }

    static equals(a: anyVec, b: anyVec) {
        return Vector.from(a).equals(b);
    }

    constructor(x: number, y: number, z: number) {
        this.vals = [x, y, z];
    }

    get x() {
        return this.vals[0];
    }
    set x(val: number) {
        this.vals[0] = val;
    }

    get y() {
        return this.vals[1];
    }
    set y(val: number) {
        this.vals[1] = val;
    }

    get z() {
        return this.vals[2];
    }
    set z(val: number) {
        this.vals[2] = val;
    }

    get lengthSqr() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    get length() {
        return Math.hypot(...this.vals);
    }

    set length(val: number) {
        const len = this.length;
        this.x = (this.x / len) * val;
        this.y = (this.y / len) * val;
        this.z = (this.z / len) * val;
    }

    getIdx(idx: number) {
        return this.vals[idx];
    }

    setIdx(idx: number, val: number) {
        this.vals[idx] = val;
    }

    largestAxis(): axis {
        if (this.x > this.y && this.x > this.z) return "x";
        else if (this.y > this.x && this.y > this.z) return "y";
        else return "z";
    }

    clone() {
        return new Vector(...this.vals);
    }

    equals(v: anyVec) {
        v = Vector.from(v);
        return this.x == v.x && this.y == v.y && this.z == v.z;
    }

    offset(x: number, y: number, z: number) {
        return new Vector(this.x + x, this.y + y, this.z + z);
    }

    distanceTo(v: anyVec) {
        return this.sub(v).length;
    }

    add(v: anyVec | number) {
        if (typeof v == "number") {
            return new Vector(this.x + v, this.y + v, this.z + v);
        } else {
            v = Vector.from(v);
            return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
        }
    }

    sub(v: anyVec | number) {
        if (typeof v == "number") {
            return new Vector(this.x - v, this.y - v, this.z - v);
        } else {
            v = Vector.from(v);
            return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
        }
    }

    mul(v: anyVec | number) {
        if (typeof v == "number") {
            return new Vector(this.x * v, this.y * v, this.z * v);
        } else {
            v = Vector.from(v);
            return new Vector(this.x * v.x, this.y * v.y, this.z * v.z);
        }
    }

    div(v: anyVec | number) {
        if (typeof v == "number") {
            return new Vector(this.x / v, this.y / v, this.z / v);
        } else {
            v = Vector.from(v);
            return new Vector(this.x / v.x, this.y / v.y, this.z / v.z);
        }
    }

    rotate(degrees: number, axis: axis) {
        if (!degrees) return this.clone();
        const radians = degrees * (Math.PI / 180);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        if (axis === "x") return new Vector(this.x, Math.round(10000 * (this.y * cos - this.z * sin)) / 10000, Math.round(10000 * (this.y * sin + this.z * cos)) / 10000);
        else if (axis === "y") return new Vector(Math.round(10000 * (this.x * cos - this.z * sin)) / 10000, this.y, Math.round(10000 * (this.x * sin + this.z * cos)) / 10000);
        else return new Vector(Math.round(10000 * (this.x * cos - this.y * sin)) / 10000, Math.round(10000 * (this.x * sin + this.y * cos)) / 10000, this.z);
    }

    min(v: anyVec) {
        v = Vector.from(v);
        return new Vector(Math.min(this.x, v.x), Math.min(this.y, v.y), Math.min(this.z, v.z));
    }

    max(v: anyVec) {
        v = Vector.from(v);
        return new Vector(Math.max(this.x, v.x), Math.max(this.y, v.y), Math.max(this.z, v.z));
    }

    floor() {
        return new Vector(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    ceil() {
        return new Vector(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    round() {
        return new Vector(Math.round(this.x), Math.round(this.y), Math.round(this.z));
    }

    lerp(v: anyVec, t: number) {
        v = Vector.from(v);
        return new Vector((1 - t) * this.x + t * v.x, (1 - t) * this.y + t * v.y, (1 - t) * this.z + t * v.z);
    }

    abs() {
        return new Vector(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
    }

    map(callbackfn: (value: number, index: number, array: number[]) => number) {
        return new Vector(...(<[number, number, number]>this.vals.map(callbackfn)));
    }

    normalized() {
        const vec = new Vector(...this.vals);
        vec.length = 1;
        return vec;
    }

    dot(v: anyVec) {
        v = Vector.from(v);
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    transform(mat: Matrix) {
        const [x, y, z] = this.vals;
        const vals = mat.vals;
        const w = 1 / (vals[3] * x + vals[7] * y + vals[11] * z + vals[15]);

        const result = new Vector(0, 0, 0);
        result.x = (vals[0] * x + vals[4] * y + vals[8] * z + vals[12]) * w;
        result.y = (vals[1] * x + vals[5] * y + vals[9] * z + vals[13]) * w;
        result.z = (vals[2] * x + vals[6] * y + vals[10] * z + vals[14]) * w;

        return result;
    }

    transformDirection(mat: Matrix) {
        const [x, y, z] = this.vals;
        const vals = mat.vals;

        const result = new Vector(0, 0, 0);
        result.x = vals[0] * x + vals[4] * y + vals[8] * z;
        result.y = vals[1] * x + vals[5] * y + vals[9] * z;
        result.z = vals[2] * x + vals[6] * y + vals[10] * z;
        result.length = this.length;

        return result;
    }

    print() {
        return `${this.x} ${this.y} ${this.z}`;
    }

    toArray() {
        return [this.x, this.y, this.z] as [number, number, number];
    }

    toString() {
        return `(${this.vals[0]}, ${this.vals[1]}, ${this.vals[2]})`;
    }

    *[Symbol.iterator]() {
        yield this.vals[0];
        yield this.vals[1];
        yield this.vals[2];
    }
}

export class VectorSet<T extends Vector3 = Vector3> implements Set<T> {
    private map = new Map<string, T>();

    get size() {
        return this.map.size;
    }

    add(value: T) {
        this.map.set(`${value.x} ${value.y} ${value.z}`, value);
        return this;
    }

    clear() {
        this.map.clear();
    }

    delete(value: T) {
        return this.map.delete(`${value.x} ${value.y} ${value.z}`);
    }

    *values() {
        for (const value of this.map.values()) yield value;
    }

    keys = this.values;

    *entries() {
        for (const value of this.map.values()) yield <[T, T]>[value, value];
    }

    forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any) {
        for (const entry of this.entries()) callbackfn.apply(thisArg, [entry[0], entry[1], this]);
    }

    has(value: Vector3) {
        return this.map.has(`${value.x} ${value.y} ${value.z}`);
    }

    [Symbol.iterator] = this.values;
    [Symbol.toStringTag] = "vectorSet";
}
