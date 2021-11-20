import { BlockLocation } from 'mojang-minecraft';
import { Mask } from '../modules/mask.js';
import { RawText } from '../modules/rawtext.js';
import { PlayerSession } from '../sessions.js';

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
	 * Applies the brush's effect somewhere in the world.
	 * @param loc The location where the brush is being applied
	 * @param session The session that's using this brush
	 * @param mask An optional mask to decide where the brush can affect the world
	 */
	public abstract apply(loc: BlockLocation, session: PlayerSession, mask?: Mask): void;
}