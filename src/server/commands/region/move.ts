import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder, assertValidNumber } from '@modules/assert.js';
import { vector } from '../../util.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { Regions } from '@modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'move',
    description: 'Move the selection in a certain direction',
    usage: [
        {
            name: 'amount',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }, {
            name: 'offset',
            type: 'Direction',
            default: Cardinal.parseArgs(['me']).result
        }
    ]
};

commandList['move'] = [registerInformation, (session, builder, args) => {
    const dir = args.get('offset').getDirection(builder) as vector;
    let direction = dir.map(v => {return v * args.get('amount')}) as vector;
    
    const [start, end] = session.getSelectionRange();
    const movedStart = start.offset(...direction);
    const movedEnd = end.offset(...direction);
    
    const history = session.getHistory();
    history.record();
    history.addUndoStructure(start, end, 'any');
    history.addUndoStructure(movedStart, movedEnd, 'any');    
    
    Regions.save('temp_move', start, end, builder);
    let count = set(session, Pattern.parseArgs(['air']).result);
    Regions.load('temp_move', movedStart, builder, 'absolute');
    count += Regions.getBlockCount('temp_move', builder);
    Regions.delete('temp_move', builder);
    
    history.addRedoStructure(start, end, 'any');
    history.addRedoStructure(movedStart, movedEnd, 'any');
    history.commit();
    
    return `Set ${count} blocks successfully.`;
}];
