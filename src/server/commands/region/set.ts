import { PlayerSession } from '../../sessions.js';
import { printDebug, regionMax, regionMin } from '../../util.js';
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
    if (session.getBlocksSelected().length == 0) {
        throw 'You need to make a selection to set!';
    }
    if (session.usingItem && !session.globalPattern.toString()) {
        throw 'You need to specify a block to set the selection to!';
    }
    
    const pattern = session.usingItem ? session.globalPattern : args.get('pattern');

    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = regionMin(pos1, pos2);
        var end = regionMax(pos1, pos2);
        history.addUndoStructure(start, end, 'any');
    }
    
    const count = set(session, pattern);
    
    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();

    return RawText.translate('worldedit.set.changed').with(`${count}`);
}];
