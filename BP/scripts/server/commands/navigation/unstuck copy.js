import { Server } from '../../../library/Minecraft.js';
import { assertBuilder, assertNoArgs } from '../../modules/assert.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation } from '../../util.js';
const registerInformation = {
    cancelMessage: true,
    name: 'unstuck',
    description: 'Moves you out of blocks.',
    usage: ''
};
Server.command.register(registerInformation, (chatmsg, args) => {
    const sender = chatmsg.sender;
    assertBuilder(sender);
    assertNoArgs(args);
    let blockLoc = getPlayerBlockLocation(sender);
    const [dimension, dimName] = getPlayerDimension(sender);
    do {
        if (dimension.isEmpty(blockLoc) && dimension.isEmpty(blockLoc.offset(0, 1, 0))) {
            break;
        }
    } while (blockLoc.y += 1);
    if (Server.runCommand(`tp ${sender.nameTag} ${printLocation(blockLoc, false)}`, dimName).error) {
        throw 'Failed to teleport you!';
    }
    Server.broadcast(`Whoosh!`, sender.nameTag);
});
