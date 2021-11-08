import { Brush } from './base_brush.js';
import { SphereShape } from '../shapes/sphere.js';
export class SphereBrush extends Brush {
    constructor(radius, pattern, hollow) {
        super();
        this.shape = new SphereShape(radius);
        this.shape.usedInBrush = true;
        this.pattern = pattern;
        this.hollow = hollow;
    }
    resize(value) {
        this.shape = new SphereShape(value);
        this.shape.usedInBrush = true;
    }
    apply(loc, session, mask) {
        this.shape.generate(loc, this.pattern, mask, session, { 'hollow': this.hollow });
    }
}
