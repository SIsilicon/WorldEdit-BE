import { PlayerSession } from '../../sessions.js';
import { registerCommand } from '../register_commands.js';
import { BlockLocation } from 'mojang-minecraft';
import { Jobs } from '@modules/jobs.js';
import { Vector } from '@modules/vector.js';
import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Mask } from '@modules/mask.js';
import { RawText } from '@library/Minecraft.js';

const registerInformation = {
    name: 'replace',
    permission: 'worldedit.region.replace',
    description: 'commands.wedit:replace.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask'
        }, {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

function* getAffectedBlocks(session: PlayerSession, mask: Mask): Generator<void, BlockLocation[]> {
    let blocks: BlockLocation[] = [];
    const dim = session.getPlayer().dimension;
    const selectedBlocks = session.getBlocksSelected();
    let i = 0;
    for (const blockLoc of selectedBlocks) {
        if (mask.matchesBlock(blockLoc, dim)) {
            blocks.push(blockLoc);
        }
        yield;
    }
    return blocks;
}

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    if (args.get('_using_item') && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const mask = args.get('_using_item') ?  session.globalMask : args.get('mask');
    const pattern = args.get('_using_item') ? session.globalPattern : args.get('pattern');
    
    const job = Jobs.startJob(builder, 2);
    const history = session.getHistory();
    const record = history.record();
    try {
        const affectedBlocks = yield* getAffectedBlocks(session, mask);
        
        if (session.selectionMode == 'cuboid' || session.selectionMode == 'extend') {
            const [pos1, pos2] = session.getSelectionPoints();
            var start = Vector.min(pos1, pos2).toBlock();
            var end = Vector.max(pos1, pos2).toBlock();
            history.addUndoStructure(record, start, end, affectedBlocks);
        }
        
        var i = 0;
        var count = 0;
        const dim = builder.dimension;
        for (const blockLoc of affectedBlocks) {
            if (!pattern.setBlock(blockLoc, dim)) {
                count++;
            }
            yield;
        }
        
        history.recordSelection(record, session);
        history.addRedoStructure(record, start, end, affectedBlocks);
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    } finally {
        Jobs.finishJob(job);
    }

    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
});
