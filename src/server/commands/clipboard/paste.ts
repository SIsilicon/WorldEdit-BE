import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertClipboard, assertCanBuildWithin } from '@modules/assert.js';
import { getSession } from '../../sessions.js';

import { Regions } from '@modules/regions.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Vector } from '@modules/vector.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'paste',
    description: 'commands.wedit:paste.description',
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
    assertClipboard(builder);
    
    let setSelection = args.has('s') || args.has('n');
    let pasteOriginal = args.has('o');
    let pasteContent = !args.has('n');
    
    let pasteStart: BlockLocation;
    if (pasteOriginal) {
        pasteStart = Regions.getPosition('clipboard', builder);
    } else {
        let loc = PlayerUtil.getBlockLocation(builder);
        pasteStart = Vector.sub(loc, Regions.getOrigin('clipboard', builder)).toBlock();
    }
    let pasteEnd = Vector.add(pasteStart, Vector.sub(Regions.getSize('clipboard', builder), Vector.ONE)).toBlock();
    
    const history = session.getHistory();
    history.record();
    
    if (pasteContent) {
        assertCanBuildWithin(PlayerUtil.getDimension(session.getPlayer())[1], pasteStart, pasteEnd);
        
        history.addUndoStructure(pasteStart, pasteEnd, 'any');
        if (Regions.load('clipboard', pasteStart, builder)) {
            throw RawText.translate('commands.generic.wedit:command-Fail');
        }
        history.addRedoStructure(pasteStart, pasteEnd, 'any');
    }
    
    if (setSelection) {
        session.selectionMode = 'cuboid';
        session.setSelectionPoint(0, pasteStart);
        session.setSelectionPoint(1, pasteEnd);
        history.recordSelection(session);
    }
    
    history.commit();
    
    if (pasteContent) {
        return RawText.translate('commands.wedit:paste.explain').with(`${Regions.getBlockCount('clipboard', builder)}`);
    }
    return '';
}];
