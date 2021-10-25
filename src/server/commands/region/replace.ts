import { PlayerSession } from '../../sessions.js';
import { addLocations, getPlayerDimension, regionMax, regionMin } from '../../util.js';
import { Pattern } from '../../modules/pattern.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';
import { Mask } from '../../modules/mask.js';
import { BlockLocation } from 'mojang-minecraft';

const registerInformation = {
    cancelMessage: true,
    name: 'replace',
    description: 'Replace certain blocks in the selection with other blocks',
    usage: '<mask: Mask> <pattern: Pattern>',
    example: [
        'replace dirt,grass air',
    ]
};

function getAffectedBlocks(session: PlayerSession, mask: Mask) {
    let blocks: BlockLocation[] = [];
    const dim = getPlayerDimension(session.getPlayer())[1];
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
    
    const mask = Mask.parseArg(args[0]);
    const pattern = session.usePickerPattern ? session.getPickerPatternParsed() : Pattern.parseArg(args[1]);
    
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
    const dim = getPlayerDimension(session.getPlayer())[1];
    for (const blockLoc of affectedBlocks) {
        if (!pattern.setBlock(blockLoc, dim)) {
            count++;
        }
    }

    history.addRedoStructure(start, end, affectedBlocks);
    history.commit();

    return RawText.translate('worldedit.set.changed').with(`${count}`);
}];
