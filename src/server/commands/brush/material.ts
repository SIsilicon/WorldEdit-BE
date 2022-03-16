import { commandList } from '../command_list.js';

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
        throw 'commands.wedit:brush.noBind';
    }
    
    session.setToolProperty(null, 'material', args.get('pattern'));
    return 'commands.generic.wedit:wandInfo';
}];