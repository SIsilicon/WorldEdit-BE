import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';
import { getSession } from '../../sessions.js';

import { Regions } from '../../modules/regions.js';
import { addLocations, getPlayerBlockLocation, printLocation, subtractLocations } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
    cancelMessage: true,
    name: 'paste',
    description: 'Paste your clipboard in to the world',
    usage: '',
};

commandList['paste'] = [registerInformation, (session, builder, args) => {
    if (!Regions.has('clipboard', builder)) {
        throw RawText.translate('worldedit.error.empty-clipboard');
    }

    const history = session.getHistory();
    const loc = getPlayerBlockLocation(builder);
    const pasteStart = subtractLocations(loc, Regions.getOrigin('clipboard', builder))
    const pasteEnd = addLocations(pasteStart, subtractLocations(Regions.getSize('clipboard', builder), new BlockLocation(1, 1, 1)));
    
    history.record();
    history.addUndoStructure(pasteStart, pasteEnd, 'any');
    
    if (Regions.load('clipboard', loc, builder, 'relative')) {
        history.cancel();
        throw RawText.translate('worldedit.error.command-fail');
    }
    
    history.addRedoStructure(pasteStart, pasteEnd, 'any');
    history.commit();
    return RawText.translate('worldedit.paste.explain').with(`${Regions.getBlockCount('clipboard', builder)}`);
}];
