import { Regions } from '@modules/regions.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'clearclipboard',
    permission: 'worldedit.clipboard.clear',
    description: 'commands.wedit:clearclipboard.description'
};

commandList['clearclipboard'] = [registerInformation, function (session, builder, args) {
    if (Regions.delete('clipboard', builder)) {
        throw 'commands.generic.wedit:commandFail';
    }
    return 'commands.wedit:clearclipboard.explain';
}];
