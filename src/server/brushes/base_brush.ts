import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { MAX_BRUSH_RADIUS } from '@config.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@notbeer-api';

/**
 * This class is the base for all brush types available in WorldEdit.
 */
export abstract class Brush {
    /**
    * A method that changes the size of the brush.
    * @param size The new size of the brush
    */
    public abstract resize(size: number): void;
    
    /**
    * A method that changes the material of the brush.
    * @param material The new material of the brush
    */
    public abstract paintWith(material: Pattern): void;
    
    /**
    * Applies the brush's effect somewhere in the world.
    * @param loc The location where the brush is being applied
    * @param session The session that's using this brush
    * @param mask An optional mask to decide where the brush can affect the world
    */
    public abstract apply(loc: BlockLocation, session: PlayerSession, mask?: Mask): Generator<void, void>;

    public assertSizeInRange(size: number) {
        if (size > MAX_BRUSH_RADIUS) {
            throw RawText.translate('commands.wedit:brush.tooLarge').with(MAX_BRUSH_RADIUS);
        }
    }
}