import { commandList } from '../command_list.js';

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
    if (!session.hasToolProperty('brush')) {
        throw 'commands.wedit:brush.noBind';
    }
    
    session.setToolProperty('size', args.get('size'));
    return 'commands.generic.wedit:wandInfo';
}];