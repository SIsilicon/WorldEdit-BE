import { RawText } from '../../modules/rawtext.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'clearhistory',
    description: 'Clear your editing history.',
    usage: '',
};
commandList['clearhistory'] = [registerInformation, (session, builder, args) => {
        const history = session.getHistory();
        history.clear();
        return RawText.translate('worldedit.clearhistory.cleared');
    }];
