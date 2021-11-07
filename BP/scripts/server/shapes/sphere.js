import { Shape } from './base_shape.js';
export class SphereShape extends Shape {
    constructor(radiusX, radiusY, radiusZ) {
        super();
        this.radii = [0, 0, 0];
        this.radii[0] = radiusX;
        this.radii[1] = radiusY ?? this.radii[0];
        this.radii[2] = radiusZ ?? this.radii[1];
    }
    getRegion(loc) {
        return [
            loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]),
            loc.offset(this.radii[0], this.radii[1], this.radii[2])
        ];
    }
    prepGeneration(genVars, options) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map(v => v + 0.01);
    }
    inShape(relLoc, genVars) {
        if (genVars.isHollow) {
            let hLocal = [
                relLoc.x / (genVars.radiiOff[0] - 1.0),
                relLoc.y / (genVars.radiiOff[1] - 1.0),
                relLoc.z / (genVars.radiiOff[2] - 1.0)
            ];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] + hLocal[2] * hLocal[2] < 1.0) {
                return false;
            }
        }
        let local = [
            relLoc.x / genVars.radiiOff[0],
            relLoc.y / genVars.radiiOff[1],
            relLoc.z / genVars.radiiOff[2]
        ];
        if (local[0] * local[0] + local[1] * local[1] + local[2] * local[2] <= 1.0) {
            return true;
        }
        return false;
    }
}
