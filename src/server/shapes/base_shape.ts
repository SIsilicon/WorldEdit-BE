import { assertCanBuildWithin } from '@modules/assert.js';
import { Jobs } from '@modules/jobs.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { contentLog, Server, Vector } from '@notbeer-api';
import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { getWorldMinY, getWorldMaxY } from '../util.js';

export type shapeGenOptions = {
    hollow?: boolean,
    wall?: boolean,
    recordHistory?: boolean
};

export type shapeGenVars = {
    isSolidCuboid?: boolean,
    [k: string]: any
};

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
    public* generate(loc: BlockLocation, pattern: Pattern, mask: Mask, session: PlayerSession, options?: shapeGenOptions): Generator<number | string, number> {
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
        
        const history = (options?.recordHistory ?? true) ? session.getHistory() : null;
        const record = history?.record(this.usedInBrush);
        try {
            let count = 0;
            if (canGenerate) {
                this.genVars = {};
                this.prepGeneration(this.genVars, options);

                // TODO: Localize
                let activeMask = mask;
                activeMask = !activeMask ? session.globalMask : (session.globalMask ? mask.intersect(session.globalMask) : activeMask);
                const patternInCommand = pattern.getPatternInCommand();
                if (this.genVars.isSolidCuboid && patternInCommand && (!activeMask || activeMask.empty())) {
                    contentLog.debug('Using /fill command(s).');
                    const size = Vector.sub(max, min).add(1);
                    const fillMax = 32;
                    history?.addUndoStructure(record, min, max, 'any');

                    yield 'Generating blocks...';
                    for (let z = 0; z < size.z; z += fillMax)
                    for (let y = 0; y < size.y; y += fillMax)
                    for (let x = 0; x < size.x; x += fillMax) {
                        const subStart = Vector.add(min, [x, y, z]);
                        const subEnd = Vector.min(
                            new Vector(x, y, z).add(fillMax), size
                        ).add(min).sub(Vector.ONE);
                        Server.runCommand(`fill ${subStart.print()} ${subEnd.print()} ${patternInCommand}`);
                        
                        const subSize = subEnd.sub(subStart).add(1);
                        count += subSize.x * subSize.y * subSize.z;
                        yield count / (size.x * size.y * size.z);
                    }
                    history?.addRedoStructure(record, min, max, 'any');    
                } else {
                    let progress = 0;
                    const blocks = min.blocksBetween(max);
                    yield 'Calculating shape...';
                    for (const block of blocks) {
                        yield ++progress / blocks.length;
                        
                        if (!activeMask.matchesBlock(block, dimension)) {
                            continue;
                        }
                        
                        if (this.inShape(Vector.sub(block, loc).toBlock(), this.genVars)) {
                            blocksAffected.push(block);
                        }
                    }

                    progress = 0;
                    yield 'Generating blocks...';
                    history?.addUndoStructure(record, min, max, blocksAffected);
                    for (const block of blocksAffected) {
                        if (pattern.setBlock(block, dimension)) {
                            count++;
                        }
                        yield ++progress / blocksAffected.length;
                    }
                    history?.addRedoStructure(record, min, max, blocksAffected);
                }
            }
            
            history?.commit(record);
            return count;
        } catch(e) {
            history?.cancel(record);
            throw e;
        }
    }
}