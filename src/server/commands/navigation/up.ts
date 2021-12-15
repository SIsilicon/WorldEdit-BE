import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertValidNumber } from '@modules/assert.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { printLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'up',
    description: 'commands.wedit:up.description',
    usage: [
        {
            name: 'height',
            type: 'int',
            range: [1, null] as [number, null]
        }
    ]
};

commandList['up'] = [registerInformation, (session, builder, args) => {
    const height = args.get('height') as number;
    
    let blockLoc = PlayerUtil.getBlockLocation(builder);
    const [dimension, dimName] = PlayerUtil.getDimension(builder);
    for (let i = 0; i < height; i++, blockLoc = blockLoc.offset(0, 1, 0)) {
        if (!dimension.isEmpty(blockLoc.offset(0, 2, 0))) {
                break;
        }
    }

    Server.runCommand(`tp "${builder.name}" ${printLocation(blockLoc, false)}`, dimName);
    Server.runCommand(`setblock ${printLocation(blockLoc.offset(0, -1, 0), false)} glass`, dimName);
    return RawText.translate('worldedit.up.moved');
}];
