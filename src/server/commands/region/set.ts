import { PlayerSession } from '../../sessions.js';
import { getPlayerDimension, regionMax, regionMin } from '../../util.js';
import { Pattern } from '../../modules/pattern.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
    cancelMessage: true,
    name: 'set',
    description: 'Set all the blocks in the selection',
    usage: '<pattern: Pattern>',
    example: [
        'set air',
        'set stone:2',
        'set wool[\'color\':\'red\'],dirt'
    ]
};

/*
    @return number of blocks set
*/
export function set(session: PlayerSession, pattern: Pattern) {
    let count = 0;
    const dim = PlayerUtil.getDimension(session.getPlayer())[1];
    for (const blockLoc of session.getBlocksSelected()) {
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
    if (args.length == 0 && !session.usePickerPattern || session.usePickerPattern && !session.getPickerPatternParsed()) {
        throw 'You need to specify a block to set the selection to!';
    }
    
    const pattern = session.usePickerPattern ? session.getPickerPatternParsed() : Pattern.parseArg(args[0]);

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
