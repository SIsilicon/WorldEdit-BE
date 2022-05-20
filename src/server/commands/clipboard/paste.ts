import { assertClipboard, assertCanBuildWithin } from '@modules/assert';
import { PlayerUtil } from '@modules/player_util.js';
import { contentLog, RawText, regionSize, regionTransformedBounds, Vector } from '@notbeer-api';
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
    assertClipboard(session);
    
    let setSelection = args.has('s') || args.has('n');
    let pasteOriginal = args.has('o');
    let pasteContent = !args.has('n');
    
    const rotation = session.clipboardTransform.rotation;
    const flip = session.clipboardTransform.flip;
    const bounds = regionTransformedBounds(Vector.ZERO.toBlock(), session.clipboard.getSize().offset(-1, -1, -1), Vector.ZERO, rotation, flip);
    const size = Vector.from(regionSize(bounds[0], bounds[1]));

    let pasteStart: Vector;
    if (pasteOriginal) {
        pasteStart = session.clipboardTransform.originalLoc;
    } else {
        let loc = PlayerUtil.getBlockLocation(builder);
        pasteStart = Vector.add(loc, session.clipboardTransform.relative);
    }
    pasteStart = pasteStart.sub(size.mul(0.5).sub(1));
    let pasteEnd = pasteStart.add(Vector.sub(size, Vector.ONE));
    
    const history = session.getHistory();
    const record = history.record();
    try {
        if (pasteContent) {
            assertCanBuildWithin(builder.dimension, pasteStart.toBlock(), pasteEnd.toBlock());
            
            history.addUndoStructure(record, pasteStart.toBlock(), pasteEnd.toBlock(), 'any');
            if (session.clipboard.load(pasteStart.toBlock(), builder.dimension, session.clipboardTransform)) {
                throw RawText.translate('commands.generic.wedit:commandFail');
            }
            history.addRedoStructure(record, pasteStart.toBlock(), pasteEnd.toBlock(), 'any');
        }
        
        if (setSelection) {
            session.selectionMode = session.selectionMode == 'extend' ? 'extend' : 'cuboid';
            session.setSelectionPoint(0, pasteStart.toBlock());
            session.setSelectionPoint(1, pasteEnd.toBlock());
            history.recordSelection(record, session);
        }
        
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    }
    
    if (pasteContent) {
        return RawText.translate('commands.wedit:paste.explain').with(`${session.clipboard.getBlockCount()}`);
    }
    return '';
});
