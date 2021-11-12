import { BlockLocation } from 'mojang-minecraft';
import { Mask } from '../modules/mask.js';
import { RawText } from '../modules/rawtext.js';
import { PlayerSession } from '../sessions.js';

export abstract class Brush {
	public abstract resize(size: number): void;
	
	public abstract apply(loc: BlockLocation, session: PlayerSession, mask?: Mask): void;
}