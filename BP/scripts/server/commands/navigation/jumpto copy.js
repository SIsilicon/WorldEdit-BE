import { BlockLocation } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder, assertNoArgs } from '../../modules/assert.js';
import { getPlayerDimension, printLocation, requestPlayerDirection } from '../../util.js';
const registerInformation = {
    cancelMessage: true,
    name: 'jumpto',
    description: 'Teleports you to the top of a block you\'re looking at.',
    usage: 'jumpto'
};
Server.command.register(registerInformation, (chatmsg, args) => {
    const sender = chatmsg.sender;
    assertBuilder(sender);
    assertNoArgs(args);
    const [dimension, dimName] = getPlayerDimension(sender);
    const origin = sender.location;
    requestPlayerDirection(sender).then(dir => {
        let hit;
        for (let i = 0; i < 100; i += 0.2) {
            const point = new BlockLocation(Math.floor(origin.x + dir.x * i), Math.floor(origin.y + dir.y * i), Math.floor(origin.z + dir.z * i));
            if (!dimension.isEmpty(point)) {
                hit = point;
                break;
            }
        }
        if (!hit || Server.runCommand(`tp ${sender.nameTag} ${printLocation(hit, false)}`, dimName).error) {
            Server.broadcast('§cFailed to teleport you!', sender.nameTag);
            return;
        }
        Server.command.getRegistration('unstuck').callback({ sender: sender }, []);
    });
});
