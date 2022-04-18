import { assertHistoryNotRecording } from '@modules/assert.js';
import { RawText } from '@library/Minecraft.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'clearhistory',
    permission: 'worldedit.history.clear',
    description: 'commands.wedit:clearhistory.description'
};

registerCommand(registerInformation, function (session, builder, args) {
    const history = session.getHistory();
    assertHistoryNotRecording(history);
    history.clear();
    return RawText.translate('commands.wedit:clearhistory.explain');
});
