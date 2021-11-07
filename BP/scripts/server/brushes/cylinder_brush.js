import { Brush } from './base_brush.js';
import { CylinderShape } from '../shapes/cylinder.js';
export class CylinderBrush extends Brush {
    constructor(radius, height, pattern, hollow) {
        super();
        this.shape = new CylinderShape(height, radius);
        this.height = height;
        this.pattern = pattern;
        this.hollow = hollow;
    }
    resize(value) {
        this.shape = new CylinderShape(this.height, value);
    }
    apply(loc, session, mask) {
        this.shape.generate(loc, this.pattern, mask, session, { 'hollow': this.hollow });
    }
}
