import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { RawText, Vector } from '@notbeer-api';
import { PlayerSession } from '../../sessions.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'set',
    permission: 'worldedit.region.set',
    description: 'commands.wedit:set.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

/**
 * @return number of blocks set
 */
export function* set(session: PlayerSession, pattern: Pattern, mask?: Mask): Generator<void> {
    let count = 0;
    const dim = session.getPlayer().dimension;
    for (const blockLoc of session.getBlocksSelected()) {
        if (mask && !mask.matchesBlock(blockLoc, dim)) {
            continue; 
        }
        
        if (pattern.setBlock(blockLoc, dim)) {
            continue;
        }
        count++;
        yield;
    }
    return count;
}

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    if (args.get('_using_item') && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const pattern = args.get('_using_item') ? session.globalPattern : args.get('pattern');

    const history = session.getHistory();
    const record = history.record();
    try {
        if (session.selectionMode == 'cuboid' || session.selectionMode == 'extend') {
            const [pos1, pos2] = session.getSelectionPoints();
            var start = Vector.min(pos1, pos2).toBlock();
            var end = Vector.max(pos1, pos2).toBlock();
            history.addUndoStructure(record, start, end, 'any');
        }
        
        var count = yield* set(session, pattern);
        
        history.recordSelection(record, session);
        history.addRedoStructure(record, start, end, (session.selectionMode == 'cuboid' || session.selectionMode == 'extend') ? 'any' : []);
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    }

    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
});
