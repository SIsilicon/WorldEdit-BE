import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';
import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'set',
    description: 'commands.wedit:set.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern',
        }
    ]
};

/**
 * @return number of blocks set
 */
export function set(session: PlayerSession, pattern: Pattern, mask?: Mask) {
    let count = 0;
    const dim = PlayerUtil.getDimension(session.getPlayer())[1];
    for (const blockLoc of session.getBlocksSelected()) {
        // printDebug(`${mask} - ${mask?.matchesBlock(blockLoc, dim)}`);
        if (mask && !mask.matchesBlock(blockLoc, dim)) {
            continue; 
        }
        
        if (pattern.setBlock(blockLoc, dim)) {
            continue;
        }
        count++;
    }
    return count;
}

commandList['set'] = [registerInformation, (session, builder, args) => {
    assertSelection(session);
    assertCanBuildWithin(PlayerUtil.getDimension(session.getPlayer())[1], ...session.getSelectionRange());
    if (session.usingItem && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const pattern = session.usingItem ? session.globalPattern : args.get('pattern');

    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = Vector.min(pos1, pos2).toBlock();
        var end = Vector.max(pos1, pos2).toBlock();
        history.addUndoStructure(start, end, 'any');
    }
    
    const count = set(session, pattern);
    
    history.recordSelection(session);
    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();

    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
}];
