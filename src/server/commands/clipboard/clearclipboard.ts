import { Regions } from '@modules/regions.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'clearclipboard',
    permission: 'worldedit.clipboard.clear',
    description: 'commands.wedit:clearclipboard.description'
};

commandList['clearclipboard'] = [registerInformation, (session, builder, args) => {
    if (Regions.delete('clipboard', builder)) {
        throw RawText.translate('commands.generic.wedit:commandFail');
    }
    return RawText.translate('commands.wedit:clearclipboard.explain');
}];
