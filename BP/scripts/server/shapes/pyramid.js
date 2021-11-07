import { Shape } from './base_shape.js';
export class PyramidShape extends Shape {
    constructor(size) {
        super();
        this.size = size;
    }
    getRegion(loc) {
        return [
            loc.offset(-this.size + 1, 0, -this.size + 1),
            loc.offset(this.size - 1, this.size - 1, this.size - 1)
        ];
    }
    prepGeneration(genVars, options) {
        genVars.isHollow = options?.hollow ?? false;
    }
    inShape(relLoc, genVars) {
        const latSize = this.size - relLoc.y - 0.5;
        const local = [
            relLoc.x,
            relLoc.z
        ];
        if (genVars.isHollow) {
            const hLatSize = latSize - 1;
            if (local[0] > -hLatSize && local[0] < hLatSize && local[1] > -hLatSize && local[1] < hLatSize) {
                return false;
            }
        }
        if (local[0] > -latSize && local[0] < latSize && local[1] > -latSize && local[1] < latSize) {
            return true;
        }
        return false;
    }
}
