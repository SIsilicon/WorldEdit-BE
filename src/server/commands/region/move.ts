import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder, assertValidInteger } from '../../modules/assert.js';
import { getSession } from '../../sessions.js';
import { Pattern } from '../../modules/pattern.js';
import { Regions } from '../../modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'move',
    description: 'Move the selection in a certain direction',
    usage: '<amount> [direction]',
    example: [
        'move 5',
        'move 10 up'
    ]
};

// TODO: Finish move command
commandList['move'] = [registerInformation, (session, builder, args) => {
    if (args.length == 0) throw 'You need to specify how far to move the selection!';

    const amount = parseInt(args[0]);
    assertValidInteger(amount, args[0]);

    let dir = args[1] || 'me';
    let direction: [number, number, number] = [0, amount, 0];

    let [start, end] = session.getSelectionRange();
    let movedStart = start.offset(...direction);
    let movedEnd = end.offset(...direction);
    
    const history = session.getHistory();
    history.record();
    history.addUndoStructure(start, end, 'any');
    history.addUndoStructure(movedStart, movedEnd, 'any');    
    
    Regions.save('temp_move', start, end, builder);
    const count = set(session, Pattern.parseArg('air'));
    Regions.load('temp_move', movedStart, builder, 'absolute');
    Regions.delete('temp_move', builder);

    history.addRedoStructure(start, end, 'any');
    history.addRedoStructure(movedStart, movedEnd, 'any');
    history.commit();

    return 'Set ${count} blocks successfully.';
}];
