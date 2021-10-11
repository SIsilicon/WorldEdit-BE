import { Server } from '../../../library/Minecraft.js';
import { assertNoArgs } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';
import { raytrace } from '../../modules/raytrace.js';
import { getPlayerDimension, printLocation, requestPlayerDirection } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'jumpto',
    description: 'Teleport you to the top of a block you\'re looking at.',
    usage: ''
};
commandList['jumpto'] = [registerInformation, (session, builder, args) => {
        assertNoArgs(args);
        const [dimension, dimName] = getPlayerDimension(builder);
        const origin = builder.location;
        return requestPlayerDirection(builder).then(dir => {
            const hit = raytrace(dimension, origin, dir);
            if (!hit || Server.runCommand(`tp ${builder.nameTag} ${printLocation(hit, false)}`, dimName).error) {
                throw RawText.translate('worldedit.jumpto.none');
            }
            commandList['unstuck'][1](session, builder, []);
            return RawText.translate('worldedit.jumpto.moved');
        });
    }];
