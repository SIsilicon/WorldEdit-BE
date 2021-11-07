import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { PLAYER_HEIGHT } from '../../../config.js';
import { assertBuilder, assertNoArgs } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';
import { raytrace } from '../../modules/raytrace.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation, requestPlayerDirection } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'jumpto',
    description: 'Teleport you to the top of a block you\'re looking at.',
    usage: '',
    aliases: ['j']
};

commandList['jumpto'] = [registerInformation, (session, builder, args) => {
    assertNoArgs(args);

    const dimension = getPlayerDimension(builder)[1];
    const origin = builder.location;
    origin.y += PLAYER_HEIGHT;
    return requestPlayerDirection(builder).then(dir => {
        const hit = raytrace(dimension, origin, dir);
        if (!hit || Server.runCommand(`tp "${builder.nameTag}" ${printLocation(hit, false)}`, dimension).error) {
            throw RawText.translate('worldedit.jumpto.none');
        }
        commandList['unstuck'][1](session, builder, []);
        return RawText.translate('worldedit.jumpto.moved');
    });
}];
