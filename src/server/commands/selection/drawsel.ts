import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'drawsel',
    description: 'Toggle your selection\'s visibility.',
};

commandList['drawsel'] = [registerInformation, (session, builder, args) => {
    session.drawSelection = !session.drawSelection;
    if (session.drawSelection) {
        return RawText.translate('worldedit.drawsel.enabled');
    } else {
        return RawText.translate('worldedit.drawsel.disabled');;
    }
}];
