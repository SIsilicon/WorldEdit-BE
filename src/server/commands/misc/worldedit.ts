import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';
import { VERSION } from '@config.js';

const registerInformation = {
    name: 'worldedit',
    description: 'commands.wedit:worldedit.description',
    usage: [
        {
            subName: 'version'
        }
    ],
    aliases: ['we']
};

commandList['worldedit'] = [registerInformation, (session, builder, args) => {
    if (args.has('version')) {
        return RawText.translate('commands.wedit:worldedit.version').with(VERSION);
    }
    return '';
}];