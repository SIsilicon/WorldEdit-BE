import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'sel',
    description: 'commands.wedit:sel.description',
    aliases: ['deselect', 'desel'],
    usage: [
        {
            subName: 'cuboid'
        },
        {
            subName: 'extend'
        },
        {
            subName: '_nothing'
        }
    ]
};

commandList['sel'] = [registerInformation, (session, builder, args) => {
    if (args.has('cuboid')) {
        session.selectionMode = 'cuboid';
        return 'commands.wedit:sel.cuboid';
    } else if (args.has('extend')) {
        session.selectionMode = 'extend';
        return 'commands.wedit:sel.extend';
    } else {
        session.clearSelectionPoints();
        return 'commands.wedit:sel.clear';
    }
}];
