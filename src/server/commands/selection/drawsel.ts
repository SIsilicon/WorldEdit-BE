import { RawText } from '@notbeer-api';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'drawsel',
    permission: 'worldedit.drawsel',
    description: 'commands.wedit:drawsel.description'
};

registerCommand(registerInformation, function (session, builder, args) {
    session.selection.visible = !session.selection.visible;
    if (session.selection.visible) {
        return RawText.translate('commands.wedit:drawsel.enabled');
    } else {
        return RawText.translate('commands.wedit:drawsel.disabled');;
    }
});
