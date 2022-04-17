import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

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

commandList['hpyramid'] = [registerInformation, function* (session, builder, args) {
    args.set('h', true);
    return yield* commandList['pyramid'][1](session, builder, args) as any;
}];
