import { Server } from '@notbeer-api';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@notbeer-api';
import { printLocation } from '../../util.js';
import { getCommandFunc, registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'jumpto',
    permission: 'worldedit.navigation.jumpto.command',
    description: 'commands.wedit:jumpto.description',
    aliases: ['j']
};

registerCommand(registerInformation, function (session, builder, args) {
    const hit = PlayerUtil.traceForBlock(builder);
    if (!hit || Server.runCommand(`tp @s ${printLocation(hit, false)}`, builder).error) {
        throw RawText.translate('commands.wedit:jumpto.none');
    }
    getCommandFunc('unstuck')(session, builder, new Map());
    return RawText.translate('commands.wedit:jumpto.explain');
});
