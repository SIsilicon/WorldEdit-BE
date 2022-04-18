import { Server } from '@library/Minecraft.js';
import { RawText } from '@library/Minecraft.js';
import { getCommandFunc, registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'hpyramid',
    permission: 'worldedit.generation.pyramid',
    description: 'commands.wedit:hpyramid.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern'
        }, {
            name: 'size',
            type: 'int',
            range: [1, null] as [number, null]
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set('h', true);
    return yield* getCommandFunc('pyramid')(session, builder, args) as any;
});
