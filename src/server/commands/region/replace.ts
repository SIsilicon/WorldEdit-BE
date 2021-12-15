import { PlayerSession } from '../../sessions.js';
import { addLocations, regionMax, regionMin } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Pattern } from '@modules/pattern.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';
import { Mask } from '@modules/mask.js';
import { BlockLocation } from 'mojang-minecraft';

const registerInformation = {
    name: 'replace',
    description: 'commands.wedit:replace.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask'
        }, {
            name: 'pattern',
            type: 'Pattern',
        }
    ]
};

function getAffectedBlocks(session: PlayerSession, mask: Mask) {
    let blocks: BlockLocation[] = [];
    const dim = PlayerUtil.getDimension(session.getPlayer())[1];
    for (const blockLoc of session.getBlocksSelected()) {
        if (mask.matchesBlock(blockLoc, dim)) {
                blocks.push(blockLoc);
        }
    }
    return blocks;
}

commandList['replace'] = [registerInformation, (session, builder, args) => {
    if (session.getBlocksSelected().length == 0) {
        throw 'You need to make a selection to replace!';
    }
    
    const mask = args.get('mask');
    const pattern = session.usingItem ? session.globalPattern : args.get('pattern');
    
    const history = session.getHistory();
    history.record();

    const affectedBlocks = getAffectedBlocks(session, mask);
    
    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = regionMin(pos1, pos2);
        var end = regionMax(pos1, pos2);
        history.addUndoStructure(start, end, affectedBlocks);
    }
    
    let count = 0;
    const dim = PlayerUtil.getDimension(session.getPlayer())[1];
    for (const blockLoc of affectedBlocks) {
        if (!pattern.setBlock(blockLoc, dim)) {
                count++;
        }
    }

    history.addRedoStructure(start, end, affectedBlocks);
    history.commit();

    return RawText.translate('worldedit.set.changed').with(`${count}`);
}];
