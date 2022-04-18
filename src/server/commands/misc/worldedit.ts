import { registerCommand } from '../register_commands.js';
import { VERSION } from '@config.js';
import { RawText } from '@library/Minecraft.js';

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

registerCommand(registerInformation, function (session, builder, args) {
    if (args.has('version')) {
        return RawText.translate('commands.wedit:worldedit.version').with(VERSION);
    }
    return '';
});