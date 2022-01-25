import { Shape, shapeGenOptions, shapeGenVars } from './base_shape.js';
import { BlockLocation } from 'mojang-minecraft';

export class CylinderShape extends Shape {
    private radii: [number, number] = [0, 0];
    private height: number;
    
    constructor(height: number, radiusX: number, radiusZ?: number) {
        super();
        this.height = height;
        this.radii[0] = radiusX;
        this.radii[1] = radiusZ ?? this.radii[0];
    }
    
    public getRegion(loc: BlockLocation) {
        loc = loc.offset(0, -this.height/2, 0);
        return <[BlockLocation, BlockLocation]>[
            loc.offset(-this.radii[0], 0, -this.radii[1]),
            loc.offset(this.radii[0], this.height-1, this.radii[1])
        ];
    }
    
    public getYRange(x: number, z: number) {
        let [lX, lZ] = [
            x / (this.radii[0] + 0.5),
            z / (this.radii[1] + 0.5)
        ];
        return (lX*lX + lZ*lZ > 1.0) ? null : <[number, number]>[0, this.height-1];
    }
    
    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map(v => v + 0.5);
    }
    
    protected inShape(relLoc: BlockLocation, genVars: shapeGenVars) {
        if (genVars.isHollow) {
            let hLocal = [
                relLoc.x / (genVars.radiiOff[0] - 1.0),
                relLoc.z / (genVars.radiiOff[1] - 1.0)
            ];
            if (hLocal[0]*hLocal[0] + hLocal[1]*hLocal[1] < 1.0) {
                return false;
            }
        }
        
        let local = [
            relLoc.x / genVars.radiiOff[0],
            relLoc.z / genVars.radiiOff[1]
        ];
        if (local[0]*local[0] + local[1]*local[1] <= 1.0) {
            return true;
        }
        
        return false;
    }
}