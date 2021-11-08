import { Brush } from './base_brush.js';
import { CylinderShape } from '../shapes/cylinder.js';
export class CylinderBrush extends Brush {
    constructor(radius, height, pattern, hollow) {
        super();
        this.shape = new CylinderShape(height, radius);
        this.shape.usedInBrush = true;
        this.height = height;
        this.pattern = pattern;
        this.hollow = hollow;
    }
    resize(value) {
        this.shape = new CylinderShape(this.height, value);
        this.shape.usedInBrush = true;
    }
    apply(loc, session, mask) {
        this.shape.generate(loc, this.pattern, mask, session, { 'hollow': this.hollow });
    }
}
