import { Server } from '@library/Minecraft.js';
import { registerCommand } from '../register_commands.js';
import { WAND_ITEM } from '@config.js';
import { RawText } from '@library/Minecraft.js';

const registerInformation = {
    name: 'wand',
    permission: 'worldedit.wand',
    description: 'commands.wedit:wand.description'
};

registerCommand(registerInformation, function (session, builder, args) {
    Server.runCommand(`give @s ${WAND_ITEM}`, builder);
    session.bindTool('selection_wand', WAND_ITEM);
    return RawText.translate('commands.wedit:wand.explain');
});
