import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'range',
    permission: 'worldedit.brush.options.range',
    description: 'commands.wedit:range.description',
    usage: [
        {
            name: 'range',
            type: 'int',
            range: [1, null] as [number, null],
            default: -1
        }
    ]
};

commandList['range'] = [registerInformation, (session, builder, args) => {
    if (!session.hasToolProperty(null, 'brush')) {
        throw 'commands.wedit:brush.noBind';
    }
    
    session.setToolProperty(null, 'range', args.get('range'));
    return 'commands.generic.wedit:wandInfo';
}];