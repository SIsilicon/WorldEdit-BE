import { Server } from '../../../library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'hsphere',
    description: 'Generate a hollow sphere.',
    usages: [
        '[-r] <pattern: Pattern> <radii: int>',
        '[-r] <pattern: Pattern> <radiiXZ: int>,<radiiY: int>',
        '[-r] <pattern: Pattern> <radiiX: int>,<radiiY: int>,<radiiZ: int>'
    ]
};

commandList['hsphere'] = [registerInformation, (session, builder, args) => {
    return commandList['sphere'][1](session, builder, args.concat('-h'));
}];
