import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@modules/rawtext.js';
import { Regions } from '@modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'move',
    permission: 'worldedit.region.move',
    description: 'commands.wedit:move.description',
    usage: [
        {
            name: 'amount',
            type: 'int',
            default: 1,
            range: [1, null] as [number, null]
        }, {
            name: 'offset',
            type: 'Direction',
            default: new Cardinal()
        }
    ]
};

commandList['move'] = [registerInformation, (session, builder, args) => {
    assertCuboidSelection(session);
    const dir = args.get('offset').getDirection(builder).mul(args.get('amount'));
    const dim = builder.dimension;
    
    const [start, end] = session.getSelectionRange();
    const movedStart = start.offset(dir.x, dir.y, dir.z);
    const movedEnd = end.offset(dir.x, dir.y, dir.z);
    
    assertCanBuildWithin(dim, start, end);
    assertCanBuildWithin(dim, movedStart, movedEnd);
    
    const history = session.getHistory();
    history.record();
    history.addUndoStructure(start, end, 'any');
    history.addUndoStructure(movedStart, movedEnd, 'any');    
    
    Regions.save('tempMove', start, end, builder);
    let count = set(session, new Pattern('air'));
    Regions.load('tempMove', movedStart, builder);
    count += Regions.getBlockCount('tempMove', builder);
    Regions.delete('tempMove', builder);
    
    history.addRedoStructure(start, end, 'any');
    history.addRedoStructure(movedStart, movedEnd, 'any');
    history.commit();
    
    return RawText.translate('commands.wedit:move.explain').with(count);
}];
