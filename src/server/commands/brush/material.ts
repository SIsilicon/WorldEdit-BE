import { commandList } from '../command_list.js';
import { createDefaultBrush } from './brush.js';

const registerInformation = {
    name: 'material',
    permission: 'worldedit.brush.options.material',
    description: 'commands.wedit:material.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

commandList['material'] = [registerInformation, (session, builder, args) => {
    if (!session.hasToolProperty(null, 'brush')) {
        session.bindTool('brush', null, createDefaultBrush());
    }
    
    session.setToolProperty(null, 'material', args.get('pattern'));
    return 'commands.wedit:brush.material.set';
}];