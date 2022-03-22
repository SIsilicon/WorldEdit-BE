import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';
import { DEFAULT_CHANGE_LIMIT, MAX_CHANGE_LIMIT } from '@config.js';
import { Server } from '@library/Minecraft.js';

const registerInformation = {
    name: 'limit',
    permission: 'worldedit.limit',
    description: 'commands.wedit:limit.description',
    usage: [
        {
            name: 'limit',
            type: 'int',
            range: [1, null] as [number, null],
            default: -1
        }
    ]
};

commandList['limit'] = [registerInformation, (session, builder, args) => {
    let changeLimit = args.get('limit') == -1 ? DEFAULT_CHANGE_LIMIT : args.get('limit');
    if (changeLimit == -1) {
        changeLimit = Infinity;
    }
    if (!Server.player.hasPermission(builder, 'worldedit.limit.unrestricted') && MAX_CHANGE_LIMIT != -1 && changeLimit > MAX_CHANGE_LIMIT) {
        throw RawText.translate('commands.wedit:limit.tooHigh').with(MAX_CHANGE_LIMIT);
    }
    session.changeLimit = changeLimit;
    return RawText.translate('commands.wedit:limit.set').with(changeLimit);
}];