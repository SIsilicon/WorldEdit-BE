import { assertHistoryNotRecording } from '@modules/assert.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'clearhistory',
    permission: 'worldedit.history.clear',
    description: 'commands.wedit:clearhistory.description'
};

commandList['clearhistory'] = [registerInformation, function (session, builder, args) {
    const history = session.getHistory();
    assertHistoryNotRecording(history);
    history.clear();
    return RawText.translate('commands.wedit:clearhistory.explain');
}];
