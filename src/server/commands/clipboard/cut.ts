import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';

import { getSession } from '../../sessions.js';
import { regionMin, regionMax } from '../../util.js';
import { copy } from './copy.js';
import { set } from '../region/set.js';
import { Pattern } from '../../modules/pattern.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
    cancelMessage: true,
    name: 'cut',
    description: 'Remove your current selection and places it in the clipboard.',
    usage: '[pattern: Pattern]',
};

commandList['cut'] = [registerInformation, (session, builder, args) => {
    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = regionMin(pos1, pos2);
        var end = regionMax(pos1, pos2);
        history.addUndoStructure(start, end, 'any');
    }
    
    if (copy(session)) {
        throw RawText.translate('worldedit.error.command-fail');
    }

    let pattern = 'air';
    if (args.length > 0) {
        pattern = args[0];
    }
    set(session, Pattern.parseArg(pattern));

    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();
    
    return RawText.translate('worldedit.cut.explain').with(`${session.getBlocksSelected().length}`);
}];
