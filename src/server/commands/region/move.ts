import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertCuboidSelection } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { Regions } from '@modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'move',
    description: 'commands.wedit:move.description',
    usage: [
        {
            name: 'amount',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
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
    
    const [start, end] = session.getSelectionRange();
    const movedStart = start.offset(dir.x, dir.y, dir.z);
    const movedEnd = end.offset(dir.x, dir.y, dir.z);
    
    const history = session.getHistory();
    history.record();
    history.addUndoStructure(start, end, 'any');
    history.addUndoStructure(movedStart, movedEnd, 'any');    
    
    Regions.save('temp_move', start, end, builder);
    let count = set(session, new Pattern('air'));
    Regions.load('temp_move', movedStart, builder);
    count += Regions.getBlockCount('temp_move', builder);
    Regions.delete('temp_move', builder);
    
    history.addRedoStructure(start, end, 'any');
    history.addRedoStructure(movedStart, movedEnd, 'any');
    history.commit();
    
    return `Set ${count} blocks successfully.`;
}];
