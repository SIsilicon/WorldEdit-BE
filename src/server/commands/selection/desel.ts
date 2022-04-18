import { Server } from '@library/Minecraft.js';
import { selectModes } from '../../sessions.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'sel',
    description: 'commands.wedit:sel.description',
    aliases: ['deselect', 'desel'],
    usage: [
        {
            flag: 'd'
        },
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

registerCommand(registerInformation, function (session, builder, args) {
    try {
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
    } finally {
        if (args.has('d')) {
            for (const selectionMode of selectModes) {
                builder.removeTag(`wedit:defaultTag_${selectionMode}`);
            }
            builder.addTag(`wedit:defaultTag_${session.selectionMode}`);
        }
    }
});
