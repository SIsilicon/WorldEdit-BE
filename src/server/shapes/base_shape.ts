import { assertCanBuildWithin } from '@modules/assert.js';
import { Jobs } from '@modules/jobs.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { Vector } from '@notbeer-api';
import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { getWorldMinY, getWorldMaxY } from '../util.js';

export type shapeGenOptions = {
    hollow?: boolean,
    wall?: boolean
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
     * Get the minimum and maximum y in a column of the shape.
     * @param x the x coordinate of the column
     * @param z the z coordinate of the column
     * @return The minimum y and maximum y if the the coordinates are within the shape; otherwise null
     */
    public abstract getYRange(x: number, z: number): [number, number] | null;
    
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
    public* generate(loc: BlockLocation, pattern: Pattern, mask: Mask, session: PlayerSession, options?: shapeGenOptions): Generator<void, number> {
        const [min, max] = this.getRegion(loc);
        const player = session.getPlayer();
        const dimension = player.dimension;
        
        const minY = getWorldMinY(player);
        min.y = Math.max(minY, min.y);
        const maxY = getWorldMaxY(player);
        max.y = Math.min(maxY, max.y);
        let canGenerate = max.y >= min.y;
        
        assertCanBuildWithin(dimension, min, max);
        const blocksAffected = [];
        mask = mask ?? new Mask();
        
        const job = this.usedInBrush ? -1 : Jobs.startJob(player, 2);
        const history = session.getHistory();
        const record = history.record(this.usedInBrush);
        try {
            if (canGenerate) {
                this.genVars = {};
                this.prepGeneration(this.genVars, options);
                
                // TODO: Localize
                Jobs.nextStep(job, 'Calculating shape...');
                let progress = 0;
                const blocks = min.blocksBetween(max);
                for (const block of blocks) {
                    yield;
                    if (!session.globalMask.matchesBlock(block, dimension) || !mask.matchesBlock(block, dimension)) {
                        continue;
                    }
                    
                    if (this.inShape(Vector.sub(block, loc).toBlock(), this.genVars)) {
                        blocksAffected.push(block);
                    }
                    // TODO: Localize
                    Jobs.setProgress(job, ++progress / blocks.length);
                }
            }
            
            Jobs.nextStep(job, 'Generating blocks...');
            let count = 0;
            if (canGenerate) {
                let progress = 0;
                history.addUndoStructure(record, min, max, blocksAffected);
                for (const block of blocksAffected) {
                    yield;
                    if (!pattern.setBlock(block, dimension)) {
                        count++;
                    }
                    Jobs.setProgress(job, ++progress / blocksAffected.length);
                }
                history.addRedoStructure(record, min, max, blocksAffected);
            }
            
            history.commit(record);
            return count;
        } catch(e) {
            history.cancel(record);
            throw e;
        } finally {
            Jobs.finishJob(job);
        }
    }
}