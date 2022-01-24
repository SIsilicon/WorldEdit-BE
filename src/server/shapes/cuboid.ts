import { Shape, shapeGenOptions, shapeGenVars } from './base_shape.js';
import { BlockLocation } from 'mojang-minecraft';

export class CuboidShape extends Shape {
    private size: [number, number, number] = [0, 0, 0];
    
    constructor(length: number, width: number, depth: number) {
        super();
        this.size = [length, width, depth];
    }
    
    public getRegion(loc: BlockLocation) {
        return <[BlockLocation, BlockLocation]>[
            loc,
            loc.offset(this.size[0]-1, this.size[1]-1, this.size[2]-1)
        ];
    }
    
    public getYRange(x: number, z: number) {
        return <[number, number]>[0, this.size[1] - 1];
    }
    
    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.isWall = options?.wall ?? false;
        genVars.end = this.size.map(v => v - 1);
    }
    
    protected inShape(relLoc: BlockLocation, genVars: shapeGenVars) {
        const end = genVars.end;
        if (genVars.isHollow &&
            relLoc.x > 0 && relLoc.x < end[0] &&
            relLoc.y > 0 && relLoc.y < end[1] &&
            relLoc.z > 0 && relLoc.z < end[2]) {
            return false;
        } else if (genVars.isWall &&
            relLoc.x > 0 && relLoc.x < end[0] &&
            relLoc.z > 0 && relLoc.z < end[2]) {
            return false;
        }
        
        return true;
    }
}