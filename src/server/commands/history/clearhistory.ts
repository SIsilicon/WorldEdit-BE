import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'clearhistory',
    description: 'commands.wedit:clearhistory.description'
};

commandList['clearhistory'] = [registerInformation, (session, builder, args) => {
    const history = session.getHistory();
    history.clear();
    return RawText.translate('worldedit.clearhistory.cleared');
}];
