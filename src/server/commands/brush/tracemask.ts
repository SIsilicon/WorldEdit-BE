import { Mask } from '@modules/mask.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'tracemask',
    permission: 'worldedit.brush.options.tracemask',
    description: 'commands.wedit:tracemask.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['tracemask'] = [registerInformation, (session, builder, args) => {
    if (!session.hasToolProperty('brush')) {
        throw 'commands.wedit:brush.noBind';
    }
    
    const mask: Mask = args.get('mask');
    session.setToolProperty('traceMask', mask.toString() ? mask : null);
    return 'commands.generic.wedit:wandInfo';
}];