import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { PLAYER_HEIGHT } from '@config.js';
import { RawText } from '@modules/rawtext.js';
import { raytrace } from '@modules/raytrace.js';
import { PlayerUtil } from '@modules/player_util.js';
import { printLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'jumpto',
    description: 'commands.wedit:jumpto.description',
    aliases: ['j']
};

commandList['jumpto'] = [registerInformation, (session, builder, args) => {
    const dimension = PlayerUtil.getDimension(builder)[1];
    const origin = builder.location;
    origin.y += PLAYER_HEIGHT;
    
    const dir = PlayerUtil.getDirection(builder);
    const hit = raytrace(dimension, origin, dir);
    if (!hit || Server.runCommand(`tp "${builder.name}" ${printLocation(hit, false)}`, dimension).error) {
        throw RawText.translate('worldedit.jumpto.none');
    }
    commandList['unstuck'][1](session, builder, new Map());
    return RawText.translate('worldedit.jumpto.moved');
}];
