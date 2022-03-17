import { commandList } from '../command_list.js';
import { createDefaultBrush } from './brush.js';

const registerInformation = {
    name: 'size',
    permission: 'worldedit.brush.options.size',
    description: 'commands.wedit:size.description',
    usage: [
        {
            name: 'size',
            type: 'int',
            range: [1, null] as [number, null]
        }
    ]
};

commandList['size'] = [registerInformation, (session, builder, args) => {
    if (!session.hasToolProperty(null, 'brush')) {
        session.bindTool('brush', null, createDefaultBrush());
    }
    
    session.setToolProperty(null, 'size', args.get('size'));
    return 'commands.wedit:brush.size.set';
}];