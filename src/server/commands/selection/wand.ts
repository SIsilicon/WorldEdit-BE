import { EntityInventoryComponent, ItemStack, ItemType, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder } from '@modules/assert.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'wand',
    description: 'commands.wedit:wand.description',
};

commandList['wand'] = [registerInformation, (session, builder, args) => {
    const dimension = PlayerUtil.getDimension(builder)[1];
    Server.runCommand(`clear "${builder.nameTag}" wedit:selection_wand`, dimension);
    Server.runCommand(`give "${builder.nameTag}" wedit:selection_wand`, dimension);
    return RawText.translate('worldedit.wand.selwand.info');
}];
