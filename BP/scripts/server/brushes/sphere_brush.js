import { Brush } from './base_brush.js';
import { SphereShape } from '../shapes/sphere.js';
/**
 * This brush creates sphere shaped patterns in the world.
 */
export class SphereBrush extends Brush {
    /**
     * @param radius The radius of the spheres
     * @param pattern The pattern the spheres will be made of
     * @param hollow Whether the spheres will be made hollow
     */
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
