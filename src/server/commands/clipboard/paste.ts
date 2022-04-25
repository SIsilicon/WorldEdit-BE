import { assertClipboard, assertCanBuildWithin } from '@modules/assert';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@notbeer-api';
import { Regions } from '@modules/regions.js';
import { Vector } from '@notbeer-api';
import { BlockLocation } from 'mojang-minecraft';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'paste',
    permission: 'worldedit.clipboard.paste',
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

registerCommand(registerInformation, function* (session, builder, args) {
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
    const record = history.record();
    try {
        if (pasteContent) {
            assertCanBuildWithin(builder.dimension, pasteStart, pasteEnd);
            
            history.addUndoStructure(record, pasteStart, pasteEnd, 'any');
            if (Regions.load('clipboard', pasteStart, builder)) {
                throw RawText.translate('commands.generic.wedit:commandFail');
            }
            history.addRedoStructure(record, pasteStart, pasteEnd, 'any');
        }
        
        if (setSelection) {
            session.selectionMode = session.selectionMode == 'extend' ? 'extend' : 'cuboid';
            session.setSelectionPoint(0, pasteStart);
            session.setSelectionPoint(1, pasteEnd);
            history.recordSelection(record, session);
        }
        
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    }
    
    if (pasteContent) {
        return RawText.translate('commands.wedit:paste.explain').with(`${Regions.getBlockCount('clipboard', builder)}`);
    }
    return '';
});
