import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'clearhistory',
    permission: 'worldedit.history.clear',
    description: 'commands.wedit:clearhistory.description'
};

commandList['clearhistory'] = [registerInformation, (session, builder, args) => {
    const history = session.getHistory();
    history.clear();
    return RawText.translate('commands.wedit:clearhistory.explain');
}];
