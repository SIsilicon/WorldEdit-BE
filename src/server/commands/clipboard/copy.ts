import { FAST_MODE } from '@config.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Jobs } from '@modules/jobs.js';
import { Mask } from '@modules/mask.js';
import { RawText, Vector } from '@notbeer-api';
import { BlockLocation, MinecraftBlockTypes } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'copy',
    permission: 'worldedit.clipboard.copy',
    description: 'commands.wedit:copy.description',
    usage: [
        {
            flag: 'a'
        }, {
            flag: 'e'
        }, {
            flag: 'm',
            name: 'mask',
            type: 'Mask'
        }
    ]
};

/**
 * Performs the ;copy command.
 * @remark This function is only exported so as to not duplicate code for the ;cut command.
 * @param session The session whose player is running this command
 * @param args The arguments that change how the copying will happen
 */
export function* copy(session: PlayerSession, args = new Map<string, any>()): Generator<number | string, boolean> {
    assertCuboidSelection(session);
    const player = session.getPlayer();
    const dimension = player.dimension;
    const [start, end] = session.getSelectionRange();
    assertCanBuildWithin(dimension, start, end);
    
    let includeEntities: boolean = args.get('_using_item') ? session.includeEntities : args.has('e');
    let includeAir: boolean = args.get('_using_item') ? session.includeAir : !args.has('a');
    let mask: Mask = args.has('m') ? args.get('m-mask') : undefined;
    
    if (session.clipboard) {
        session.deleteRegion(session.clipboard);
    }
    
    session.clipboard = session.createRegion(!FAST_MODE);
    session.clipboardTransform = {
        rotation: Vector.ZERO,
        flip: Vector.ONE,
        originalLoc: Vector.add(start, end).mul(0.5),
        relative: Vector.sub(Vector.add(start, end).mul(0.5), Vector.from(player.location).floor())
    }

    let error = false;

    if (session.clipboard.isAccurate) {
        const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
        const filter = mask || !includeAir;
        const options = {
            includeEntities,
            loc: new BlockLocation(0, 0, 0),
            dim: dimension
        };
        
        yield 'Copying blocks...';
        const blocks = start.blocksBetween(end);
        let i = 0;
        for (const block of blocks) {
            const relLoc = Vector.sub(block, start).toBlock();
            if (filter) {
                let wasAir = dimension.getBlock(block).id == 'minecraft:air';
                let isAir = wasAir || (mask ? !mask.matchesBlock(block, dimension) : false);
                if (includeAir && mask && !wasAir && isAir) {
                    options.loc = block;
                    session.clipboard.setBlock(relLoc, airBlock, options);
                    continue;
                } else if (!includeAir && isAir) {
                    continue;
                }
            }
            error ||= session.clipboard.setBlock(relLoc, dimension.getBlock(block), options);
            yield i++ / blocks.length;
        }
    } else {
        // Create a temporary copy since we'll be adding void/air blocks to the selection.
        let tempUsed = !includeAir || mask;
        const temp = session.createRegion(false);
        if (tempUsed) {
            temp.save(start, end, dimension);
            
            const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
            const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
            
            for (const block of start.blocksBetween(end)) {
                let wasAir = dimension.getBlock(block).id == 'minecraft:air';
                let isAir = wasAir || (mask ? !mask.matchesBlock(block, dimension) : false);
                if (includeAir && mask && !wasAir && isAir) {
                    dimension.getBlock(block).setPermutation(airBlock);
                } else if (!includeAir && isAir) {
                    dimension.getBlock(block).setPermutation(voidBlock);
                }
            }
        }
        error = session.clipboard.save(start, end, dimension, {includeEntities});
        if (tempUsed) {
            temp.load(start, dimension);
            session.deleteRegion(temp);
        }
    }
    
    return error;
}

registerCommand(registerInformation, function* (session, builder, args) {
    const job = Jobs.startJob(builder, 1);
    try {
        if (yield* Jobs.perform(job, copy(session, args))) {
            throw RawText.translate('commands.generic.wedit:commandFail');
        }
    } finally {
        Jobs.finishJob(job);
    }
    return RawText.translate('commands.wedit:copy.explain').with(`${session.getSelectedBlockCount()}`);
});
