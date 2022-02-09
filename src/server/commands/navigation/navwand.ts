import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'navwand',
    permission: 'worldedit.setwand',
    description: 'commands.wedit:navwand.description'
};

commandList['navwand'] = [registerInformation, (session, builder, args) => {
    Server.runCommand(`clear @s wedit:navigation_wand`, builder);
    Server.runCommand(`give @s wedit:navigation_wand`, builder);
    return RawText.translate('commands.wedit:navwand.explain');
}];
