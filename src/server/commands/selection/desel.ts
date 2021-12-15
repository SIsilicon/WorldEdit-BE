import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'sel',
    description: 'commands.wedit:sel.description',
    aliases: ['deselect', 'desel']
};

// TODO: Actually change selection mode
commandList['sel'] = [registerInformation, (session, builder, args) => {
    session.clearSelectionPoints();
    return 'Selection cleared';
}];
