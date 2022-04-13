import { BlockLocation } from 'mojang-minecraft';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerSession } from '../sessions.js';
import { Brush } from './base_brush.js';
import { CuboidShape } from '../shapes/cuboid.js';
import { smooth } from '../commands/region/smooth.js';

/**
 * This smooths the terrain in the world.
 */
export class SmoothBrush extends Brush {
    private shape: CuboidShape;
    private size: number;
    private iterations: number;
    private mask: Mask;
    
    /**
    * @param radius The radius of the smoothing area
    * @param iterations The number of times the area is smoothed
    * @param mask determine what blocks affect the height map
    */
    constructor(radius: number, iterations: number, mask: Mask) {
        super();
        this.assertSizeInRange(radius);
        this.shape = new CuboidShape(radius*2+1, radius*2+1, radius*2+1);
        this.size = radius;
        this.iterations = iterations;
        this.mask = mask;
    }
    
    public resize(value: number) {
        this.assertSizeInRange(value);
        this.shape = new CuboidShape(value*2+1, value*2+1, value*2+1);
        this.size = value;
        this.shape.usedInBrush = true;
    }
    
    public paintWith(value: Pattern) {
        throw 'commands.generic.wedit:noBrushMaterial';
    }
    
    public async apply(loc: BlockLocation, session: PlayerSession, mask?: Mask) {
        const point = loc.offset(-this.size, -this.size, -this.size);
        await smooth(session, this.iterations, this.shape, point, this.mask, mask);
    }
}