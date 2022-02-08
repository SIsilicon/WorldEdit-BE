import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { printLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'unstuck',
    permission: 'worldedit.navigation.unstuck',
    description: 'commands.wedit:unstuck.description',
    aliases: ['!']
};

commandList['unstuck'] = [registerInformation, (session, builder, args) => {
    let blockLoc = PlayerUtil.getBlockLocation(builder);
    const dimension = builder.dimension;
    do {
        if (dimension.isEmpty(blockLoc) && dimension.isEmpty(blockLoc.offset(0, 1, 0))) {
                break;
        }
    }
    while (blockLoc.y += 1);

    Server.runCommand(`tp @s ${printLocation(blockLoc, false)}`, builder);
    return RawText.translate('commands.wedit:unstuck.explain');
}];
