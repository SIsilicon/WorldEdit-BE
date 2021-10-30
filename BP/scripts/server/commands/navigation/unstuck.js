import { Server } from '../../../library/Minecraft.js';
import { assertNoArgs } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'unstuck',
    description: 'Move you out of blocks.',
    usage: '',
    aliases: ['!']
};
commandList['unstuck'] = [registerInformation, (session, builder, args) => {
        assertNoArgs(args);
        let blockLoc = getPlayerBlockLocation(builder);
        const [dimension, dimName] = getPlayerDimension(builder);
        do {
            if (dimension.isEmpty(blockLoc) && dimension.isEmpty(blockLoc.offset(0, 1, 0))) {
                break;
            }
        } while (blockLoc.y += 1);
        Server.runCommand(`tp "${builder.nameTag}" ${printLocation(blockLoc, false)}`, dimName);
        return RawText.translate('worldedit.unstuck.moved');
    }];
