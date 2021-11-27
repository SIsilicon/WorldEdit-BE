import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder, assertValidNumber } from '../../modules/assert.js';
import { vector } from '../../util.js';
import { getCardinalDirection, directions } from '../../modules/directions.js';
import { Pattern } from '../../modules/pattern.js';
import { Regions } from '../../modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'move',
    description: 'Move the selection in a certain direction',
    usage: '<amount: int> [direction: Direction]',
    example: [
        'move 5',
        'move 10 up'
    ]
};

commandList['move'] = [registerInformation, (session, builder, args) => {
    const amount = args[0] ? parseInt(args[0]) : 1;
    assertValidNumber(amount, args[0]);
    
    const dir = getCardinalDirection(<directions> (args[1] ?? 'me').toLowerCase(), builder);
    let direction = dir.map(v => {return v * amount}) as vector;
    
    const [start, end] = session.getSelectionRange();
    const movedStart = start.offset(...direction);
    const movedEnd = end.offset(...direction);
    
    const history = session.getHistory();
    history.record();
    history.addUndoStructure(start, end, 'any');
    history.addUndoStructure(movedStart, movedEnd, 'any');    
    
    Regions.save('temp_move', start, end, builder);
    let count = set(session, Pattern.parseArg('air'));
    Regions.load('temp_move', movedStart, builder, 'absolute');
    count += Regions.getBlockCount('temp_move', builder);
    Regions.delete('temp_move', builder);
    
    history.addRedoStructure(start, end, 'any');
    history.addRedoStructure(movedStart, movedEnd, 'any');
    history.commit();
    
    return `Set ${count} blocks successfully.`;
}];
