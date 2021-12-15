import { commandList } from '../command_list.js';
import { Mask } from '@modules/mask.js';

const registerInformation = {
    name: 'gmask',
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
    if (args.get('mask').toString()) {
        return `Global mask set.` // TODO: Localize to worldedit.gmask.set
    } else {
        return `Global mask disabled.` // TODO: Localize to worldedit.gmask.disabled
    }
}];
