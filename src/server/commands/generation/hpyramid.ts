import { Server } from '@library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'hpyramid',
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

commandList['hpyramid'] = [registerInformation, (session, builder, args) => {
    args.set('h', true);
    return commandList['pyramid'][1](session, builder, args);
}];
