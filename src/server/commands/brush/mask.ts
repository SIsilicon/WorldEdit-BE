import { Mask } from '@modules/mask.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'mask',
    permission: 'worldedit.brush.options.mask',
    description: 'commands.wedit:mask.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['mask'] = [registerInformation, (session, builder, args) => {
    if (!session.hasToolProperty(null, 'brush')) {
        throw 'commands.wedit:brush.noBind';
    }
    
    session.setToolProperty(null, 'mask', args.get('mask'));
    return 'commands.generic.wedit:wandInfo';
}];