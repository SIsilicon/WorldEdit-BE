import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { WAND_ITEM } from '@config.js';

const registerInformation = {
    name: 'wand',
    permission: 'worldedit.wand',
    description: 'commands.wedit:wand.description'
};

commandList['wand'] = [registerInformation, (session, builder, args) => {
    Server.runCommand(`give @s ${WAND_ITEM}`, builder);
    session.bindTool('selection_wand', WAND_ITEM);
    return RawText.translate('commands.wedit:wand.explain');
}];
