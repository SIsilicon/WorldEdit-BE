import { NAV_WAND_ITEM } from '@config.js';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'navwand',
    permission: 'worldedit.setwand',
    description: 'commands.wedit:navwand.description'
};

commandList['navwand'] = [registerInformation, function (session, builder, args) {
    Server.runCommand(`give @s ${NAV_WAND_ITEM}`, builder);
    session.bindTool('navigation_wand', NAV_WAND_ITEM);
    return RawText.translate('commands.wedit:navwand.explain');
}];
