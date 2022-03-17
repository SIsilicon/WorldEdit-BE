import { Mask } from '@modules/mask.js';
import { commandList } from '../command_list.js';
import { createDefaultBrush } from './brush.js';

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
    if (!session.hasToolProperty(null, 'brush')) {
        session.bindTool('brush', null, createDefaultBrush());
    }
    
    const mask: Mask = args.get('mask');
    session.setToolProperty(null, 'traceMask', mask.empty() ? null : mask);
    return 'commands.wedit:brush.tracemask.' + (mask.empty() ? 'disabled' : 'set');
}];