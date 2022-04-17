import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'drawsel',
    permission: 'worldedit.drawsel',
    description: 'commands.wedit:drawsel.description'
};

commandList['drawsel'] = [registerInformation, function (session, builder, args) {
    session.drawSelection = !session.drawSelection;
    if (session.drawSelection) {
        return RawText.translate('commands.wedit:drawsel.enabled');
    } else {
        return RawText.translate('commands.wedit:drawsel.disabled');;
    }
}];
