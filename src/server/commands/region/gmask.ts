import { commandList } from '../command_list.js';
import { Mask } from '@modules/mask.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'gmask',
    permission: 'worldedit.global-mask',
    description: 'commands.wedit:gmask.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['gmask'] = [registerInformation, (session, builder, args) => {
    session.globalMask = args.get('mask');
    if (!args.get('mask').empty()) {
        return RawText.translate('commands.wedit:gmask.set');
    } else {
        return RawText.translate('commands.wedit:gmask.disabled');
    }
}];
