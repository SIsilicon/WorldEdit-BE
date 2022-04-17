import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';
import { setPos2 } from './pos2.js';

const registerInformation = {
    name: 'hpos2',
    permission: 'worldedit.selection.hpos',
    description: 'commands.wedit:hpos2.description'
};

commandList['hpos2'] = [registerInformation, function (session, builder, args) {
    const hit = PlayerUtil.traceForBlock(builder);
    if (!hit) {
        throw 'commands.wedit:jumpto.none';
    }
    return setPos2(session, hit);
}];
