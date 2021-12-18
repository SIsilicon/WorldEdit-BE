import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'sel',
    description: 'commands.wedit:sel.description',
    aliases: ['deselect', 'desel']
};

// TODO: Actually change selection mode
commandList['sel'] = [registerInformation, (session, builder, args) => {
    session.clearSelectionPoints();
    return RawText.translate('commands.wedit:sel.clear');
}];
