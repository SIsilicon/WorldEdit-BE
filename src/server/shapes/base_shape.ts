import { BlockLocation } from 'mojang-minecraft';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { PlayerSession } from '../sessions.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Vector } from '@modules/vector.js';
import { getWorldMinY, getWorldMaxY } from '../util.js';

export type shapeGenOptions = {
    hollow?: boolean
};

export type shapeGenVars = {[k: string]: any};

/**
 * A base shape class for generating blocks in a variety of formations.
 */
export abstract class Shape {
    /**
    * Whether the shape is being used in a brush.
    * Shapes used in a brush may handle history recording differently from other cases.
    */
    public usedInBrush = false;
    
    private genVars: shapeGenVars;
    
    /**
    * Get the bounds of the shape.
    * @param loc The location of the shape
    * @return An array containing the minimum and maximum corners of the shape bounds
    */
    public abstract getRegion(loc: BlockLocation): [BlockLocation, BlockLocation];
    
    /**
    * Prepares some variables that the shape will use when generating blocks.
    * @param genVars An object to contain variables used during shape generation ({inShape})
    * @param options Options passed from {generate}
    */
    protected abstract prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions): void;
    
    /**
    * Tells the shape generator whether a block should generate a particular location.
    * @param relLoc a location relative to the shape's center
    * @param genVars an object containing variables created in {prepGeneration}
    * @return True if a block should be generated; false otherwise
    */
    protected abstract inShape(relLoc: BlockLocation, genVars: shapeGenVars): boolean;
    
    /**
    * Generates a block formation at a certain location.
    * @param loc The location the shape will be generated at
    * @param pattern The pattern that the shape will be made with
    * @param mask The mask to decide where the shape will generate blocks
    * @param session The session that's using this shape
    * @param options A group of options that can change how the shape is generated
    */
    public generate(loc: BlockLocation, pattern: Pattern, mask: Mask, session: PlayerSession, options?: shapeGenOptions) {
        const [min, max] = this.getRegion(loc);
        const dimension = PlayerUtil.getDimension(session.getPlayer())[1];
        
        const minY = getWorldMinY(session.getPlayer());
        min.y = Math.max(minY, min.y);
        const maxY = getWorldMaxY(session.getPlayer());
        max.y = Math.min(maxY, max.y);
        let canGenerate = max.y >= min.y;
    
        const blocksAffected = [];
        mask = mask ?? new Mask();
        
        if (canGenerate) {
            this.genVars = {};
            this.prepGeneration(this.genVars, options);
            
            let retLoc: BlockLocation;
            for (const block of min.blocksBetween(max)) {
                if (!session.globalMask.matchesBlock(block, dimension) || !mask.matchesBlock(block, dimension)) {
                    continue;
                }
                
                if (this.inShape(Vector.sub(block, loc).toBlock(), this.genVars)) {
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