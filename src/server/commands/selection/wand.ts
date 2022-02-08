import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'wand',
    permission: 'worldedit.wand',
    description: 'commands.wedit:wand.description',
};

commandList['wand'] = [registerInformation, (session, builder, args) => {
    Server.runCommand(`clear @s wedit:selection_wand`, builder);
    Server.runCommand(`give @s wedit:selection_wand`, builder);
    return RawText.translate('commands.wedit:wand.explain');
}];
