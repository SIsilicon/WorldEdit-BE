import { BlockLocation, Location } from 'mojang-minecraft';

type anyVec = BlockLocation|Location|Vector|[number, number, number];
type anyLoc = BlockLocation|Location;

export class Vector {
    private vals: [number, number, number] = [0, 0, 0];
    
    static get ZERO() {return new Vector(0, 0, 0);}
    static get ONE() {return new Vector(1, 1, 1);}
    
    static from(loc: anyLoc|[number, number, number]) {
        if (Array.isArray(loc)) {
            return new Vector(...loc);
        }
        return new Vector(loc.x, loc.y, loc.z);
    }
    
    private static ensureVector(v: anyVec): Vector {
        if (v instanceof Location || v instanceof BlockLocation) {
            return Vector.from(v);
        } else if (Array.isArray(v)) {
            return new Vector(...<[number, number, number]>v);
        }
        return v;
    }
    
    static add(a: anyVec, b: anyVec) {
        return Vector.ensureVector(a).add(b);
    }
    
    static sub(a: anyVec, b: anyVec) {
        return Vector.ensureVector(a).sub(b);
    }
    
    static min(a: anyVec, b: anyVec) {
        return Vector.ensureVector(a).min(b);
    }
    
    static max(a: anyVec, b: anyVec) {
        return Vector.ensureVector(a).max(b);
    }
    
    constructor(x: number, y: number, z: number) {
        this.vals = [x, y, z];
    }
    
    get x() { return this.vals[0]; }
    get y() { return this.vals[1]; }
    get z() { return this.vals[2]; }
    
    set x(val: number) { this.vals[0] = val; }
    set y(val: number) { this.vals[1] = val; }
    set z(val: number) { this.vals[2] = val; }
    
    get length() {
        return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
    }
    
    set length(val: number) {
        const len = this.length;
        this.x = this.x / len * val;
        this.y = this.y / len * val;
        this.z = this.z / len * val;
    }
    
    clone() {
        return new Vector(...this.vals);
    }
    
    add(v: anyVec) {
        v = Vector.ensureVector(v);
        return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
    }
    
    sub(v: anyVec) {
        v = Vector.ensureVector(v);
        return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
    }
    
    mul(v: anyVec|number) {
        if (typeof v == 'number') {
            return new Vector(this.x * v, this.y * v, this.z * v);
        } else {
            v = Vector.ensureVector(v);
            return new Vector(this.x * v.x, this.y * v.y, this.z * v.z);
        }
    }
    
    rotate(rot: number, org: anyVec = Vector.ZERO) {
        org = Vector.ensureVector(org);
        let x = this.x - org.x;
        let z = this.z - org.z;
        
        let ang = rot * (Math.PI/180);
        let cos = Math.cos(ang);
        let sin = Math.sin(ang);
        return new Vector(
            Math.round(10000*(x * cos - z * sin))/10000 + org.x, this.y,
            Math.round(10000*(x * sin + z * cos))/10000 + org.z
        );
    }
    
    min(v: anyVec) {
        v = Vector.ensureVector(v);
        return new Vector(
            Math.min(this.x, v.x),
            Math.min(this.y, v.y),
            Math.min(this.z, v.z)
        );
    }
    
    max(v: anyVec) {
        v = Vector.ensureVector(v);
        return new Vector(
            Math.max(this.x, v.x),
            Math.max(this.y, v.y),
            Math.max(this.z, v.z)
        );
    }
    
    floor() {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }
    
    ceil() {
        return new Vector(
            Math.ceil(this.x),
            Math.ceil(this.y),
            Math.ceil(this.z)
        );
    }
    
    lerp(v: anyVec, t: number) {
        v = Vector.ensureVector(v);
        return new Vector(
            (1 - t) * this.x + t * v.x,
            (1 - t) * this.y + t * v.y,
            (1 - t) * this.z + t * v.z
        );
    }
    
    normalized() {
        let vec = new Vector(...this.vals);
        vec.length = 1;
        return vec;
    }
    
    print() {
        return `${this.x} ${this.y} ${this.z}`;
    }
    
    toLocation() {
        return new Location(this.x, this.y, this.z);
    }
    
    toBlock() {
        return new BlockLocation(
            Math.floor(this.x), 
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }
    
    toString() {
        return `(${this.vals[0]}, ${this.vals[1]}, ${this.vals[2]})`
    }
    
    *[Symbol.iterator] () {
        yield this.vals[0];
        yield this.vals[1];
        yield this.vals[2];
    }
}