import { Server } from '@library/Minecraft.js';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@modules/rawtext.js';
import { printLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'jumpto',
    permission: 'worldedit.navigation.jumpto.command',
    description: 'commands.wedit:jumpto.description',
    aliases: ['j']
};

commandList['jumpto'] = [registerInformation, function (session, builder, args) {
    const hit = PlayerUtil.traceForBlock(builder);
    if (!hit || Server.runCommand(`tp @s ${printLocation(hit, false)}`, builder).error) {
        throw RawText.translate('commands.wedit:jumpto.none');
    }
    commandList['unstuck'][1](session, builder, new Map());
    return RawText.translate('commands.wedit:jumpto.explain');
}];
