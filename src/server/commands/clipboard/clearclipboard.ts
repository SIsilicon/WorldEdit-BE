import { Regions } from '@modules/regions.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'clearclipboard',
    permission: 'worldedit.clipboard.clear',
    description: 'commands.wedit:clearclipboard.description'
};

registerCommand(registerInformation, function (session, builder, args) {
    if (Regions.delete('clipboard', builder)) {
        throw 'commands.generic.wedit:commandFail';
    }
    return 'commands.wedit:clearclipboard.explain';
});
