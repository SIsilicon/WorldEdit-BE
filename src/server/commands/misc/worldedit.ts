import { commandList } from '../command_list.js';
import { VERSION } from '@config.js';
import { RawText } from '@modules/rawtext.js';

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

commandList['worldedit'] = [registerInformation, function (session, builder, args) {
    if (args.has('version')) {
        return RawText.translate('commands.wedit:worldedit.version').with(VERSION);
    }
    return '';
}];