import { BlockLocation } from 'mojang-minecraft';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerSession } from '../sessions.js';
import { Brush } from './base_brush.js';
import { CylinderShape } from '../shapes/cylinder.js';

/**
 * This brush creates cylinder shaped patterns in the world.
 */
export class CylinderBrush extends Brush {
    private shape: CylinderShape;
    private pattern: Pattern;
    private height: number;
    private hollow: boolean
    
    /**
    * @param radius The radius of the cylinders
    * @param height The height of the cylinders
    * @param pattern The pattern the cylinders will be made of
    * @param hollow Whether the cylinders will be made hollow
    */
    constructor(radius: number, height: number, pattern: Pattern, hollow: boolean) {
        super();
        this.shape = new CylinderShape(height, radius);
        this.shape.usedInBrush = true;
        this.height = height;
        this.pattern = pattern;
        this.hollow = hollow;
    }
    
    public resize(value: number) {
        this.shape = new CylinderShape(this.height, value);
        this.shape.usedInBrush = true;
    }
    
    public apply(loc: BlockLocation, session: PlayerSession, mask?: Mask) {
        this.shape.generate(loc, this.pattern, mask, session, {'hollow': this.hollow});
    }
}