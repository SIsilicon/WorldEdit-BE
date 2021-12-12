import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder } from '@modules/assert.js';
import { getSession } from '../../sessions.js';

import { Regions } from '@modules/regions.js';
import { PlayerUtil } from '@modules/player_util.js';
import { addLocations, printLocation, subtractLocations } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'paste',
    description: 'Paste your clipboard into the world',
    usage: [
        {
            flag: 'o'
        }, {
            flag: 's'
        }, {
            flag: 'n'
        }
    ]
};

commandList['paste'] = [registerInformation, (session, builder, args) => {
    if (!Regions.has('clipboard', builder)) {
        throw RawText.translate('worldedit.error.empty-clipboard');
    }
    
    let setSelection = args.has('s') || args.has('n');
    let pasteOriginal = args.has('o');
    let pasteContent = !args.has('n');
    
    let loc, pasteStart: BlockLocation;
    if (pasteOriginal) {
        pasteStart = Regions.getPosition('clipboard', builder);
        loc = pasteStart;
    } else {
        loc = PlayerUtil.getBlockLocation(builder);
        pasteStart = subtractLocations(loc, Regions.getOrigin('clipboard', builder))
    }
    let pasteEnd = addLocations(pasteStart, subtractLocations(Regions.getSize('clipboard', builder), new BlockLocation(1, 1, 1)));
    
    if (pasteContent) {
        const history = session.getHistory();
        history.record();
        history.addUndoStructure(pasteStart, pasteEnd, 'any');
        
        if (Regions.load('clipboard', loc, builder, pasteOriginal ? 'absolute' : 'relative')) {
            history.cancel();
            throw RawText.translate('worldedit.error.command-fail');
        }
        
        history.addRedoStructure(pasteStart, pasteEnd, 'any');
        history.commit();
    }
    
    if (setSelection) {
        // TODO: Set selection to cuboid
        session.clearSelectionPoints();
        session.setSelectionPoint(0, pasteStart);
        session.setSelectionPoint(1, pasteEnd);
    }
    
    if (pasteContent) {
        return RawText.translate('worldedit.paste.explain').with(`${Regions.getBlockCount('clipboard', builder)}`);
    }
    return '';
}];
