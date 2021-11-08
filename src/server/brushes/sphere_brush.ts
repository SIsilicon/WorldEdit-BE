import { BlockLocation } from 'mojang-minecraft';
import { Mask } from '../modules/mask.js';
import { Pattern } from '../modules/pattern.js';
import { RawText } from '../modules/rawtext.js';
import { PlayerSession } from '../sessions.js';
import { Brush } from './base_brush.js';
import { SphereShape } from '../shapes/sphere.js';

export class SphereBrush extends Brush {
	private shape: SphereShape;
	private pattern: Pattern;
	private hollow: boolean
	
	constructor(radius: number, pattern: Pattern, hollow: boolean) {
		super();
		this.shape = new SphereShape(radius);
		this.shape.usedInBrush = true;
		this.pattern = pattern;
		this.hollow = hollow;
	}
	
	public resize(value: number) {
		this.shape = new SphereShape(value);
		this.shape.usedInBrush = true;
	}
	
	public apply(loc: BlockLocation, session: PlayerSession, mask?: Mask) {
		this.shape.generate(loc, this.pattern, mask, session, {'hollow': this.hollow});
	}
}