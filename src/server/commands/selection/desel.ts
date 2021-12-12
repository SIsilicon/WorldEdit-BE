import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'sel',
    description: 'Change selection mode (currently can only clear selection)',
    aliases: ['deselect', 'desel']
};

// TODO: Actually change selection mode
commandList['sel'] = [registerInformation, (session, builder, args) => {
    session.clearSelectionPoints();
    return 'Selection cleared';
}];
