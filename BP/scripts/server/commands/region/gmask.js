import { commandList } from '../command_list.js';
import { Mask } from '../../modules/mask.js';
const registerInformation = {
    cancelMessage: true,
    name: 'gmask',
    description: 'Set the global mask',
    usage: '[mask: Mask]',
    example: [
        'gmask',
        'gmask air',
        'gmask stone:2'
    ]
};
commandList['gmask'] = [registerInformation, (session, builder, args) => {
        if (args.length == 0) {
            session.globalMask = new Mask();
            return `Global mask disabled.`; // TODO: Localize to worldedit.gmask.disabled
        }
        else {
            session.globalMask = Mask.parseArg(args[0]);
            return `Global mask set.`; // TODO: Localize to worldedit.gmask.set
        }
    }];
