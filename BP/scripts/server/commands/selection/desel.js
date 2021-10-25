import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'sel',
    description: 'Change selection mode (currently can only clear selection)',
    usage: '',
    aliases: ['deselect', 'desel']
};
// TODO: Actually change selection mode
commandList['sel'] = [registerInformation, (session, builder, args) => {
        session.clearSelectionPoints();
        return 'Selection cleared';
    }];
