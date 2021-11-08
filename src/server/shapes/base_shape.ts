import { BlockLocation } from 'mojang-minecraft';
import { Pattern } from '../modules/pattern.js';
import { Mask } from '../modules/mask.js';
import { PlayerSession } from '../sessions.js';
import { getPlayerDimension, subtractLocations, getWorldMinY, getWorldMaxY } from '../util.js';

export type shapeGenOptions = {
	hollow?: boolean
};

export type shapeGenVars = {[k: string]: any};

export abstract class Shape {
	private genVars: shapeGenVars;
	public usedInBrush = false;
	
	public abstract getRegion(loc: BlockLocation): [BlockLocation, BlockLocation];
	
	protected abstract prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions): void;
	
	protected abstract inShape(relLoc: BlockLocation, genVars: shapeGenVars): boolean;
	
	public generate(loc: BlockLocation, pattern: Pattern, mask: Mask, session: PlayerSession, options?: shapeGenOptions) {
		const [min, max] = this.getRegion(loc);
		const dimension = getPlayerDimension(session.getPlayer())[1];
		
		const minY = getWorldMinY(session.getPlayer());
		min.y = Math.max(minY, min.y);
		const maxY = getWorldMaxY(session.getPlayer());
		max.y = Math.min(maxY, max.y);
		let canGenerate = max.y >= min.y;
	
		const blocksAffected = [];
		mask = mask ?? Mask.parseArg('');
		
		if (canGenerate) {
			this.genVars = {};
			this.prepGeneration(this.genVars, options);
			
			let retLoc: BlockLocation;
			for (const block of min.blocksBetween(max)) {
				if (!session.globalMask.matchesBlock(block, dimension) || !mask.matchesBlock(block, dimension)) {
					continue;
				}
				
				if (this.inShape(subtractLocations(block, loc), this.genVars)) {
					blocksAffected.push(block);
				}
			}
		}
		
		const history = session.getHistory();
		history.record(this.usedInBrush);
		
		let count = 0;
		if (canGenerate) {
			history.addUndoStructure(min, max, blocksAffected);
			for (const block of blocksAffected) {
				if (!pattern.setBlock(block, dimension)) {
					count++;
				}
			}
			history.addRedoStructure(min, max, blocksAffected);
		}
		
		history.commit();
		return count;
	}
}