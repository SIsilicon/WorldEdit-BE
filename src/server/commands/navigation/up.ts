import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder, assertValidInteger } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'up',
    description: 'Move you a certain number of blocks up.',
    usage: '<height: int>',
};

commandList['up'] = [registerInformation, (session, builder, args) => {
    if (args.length == 0) throw 'You need to specify how far up to travel!';
    
    const height = parseInt(args[0]);
    assertValidInteger(height, args[0]);
    if (height <= 0) throw 'You can only travel up with this command!';

    let blockLoc = getPlayerBlockLocation(builder);
    const [dimension, dimName] = getPlayerDimension(builder);
    for (let i = 0; i < height; i++, blockLoc = blockLoc.offset(0, 1, 0)) {
        if (!dimension.isEmpty(blockLoc.offset(0, 2, 0))) {
            break;
        }
    }

    Server.runCommand(`tp "${builder.nameTag}" ${printLocation(blockLoc, false)}`, dimName);
    Server.runCommand(`setblock ${printLocation(blockLoc.offset(0, -1, 0), false)} glass`, dimName);
    return RawText.translate('worldedit.up.moved');
}];
