import { Server } from '../../../library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'hcyl',
    description: 'Generate a hollow cylinder.',
    usages: [
        '[-r] <pattern: Pattern> <radii: int> [height: int]',
        '[-r] <pattern: Pattern> <radiiX: int>,<radiiZ: int> [height: int]',
    ]
};

commandList['hcyl'] = [registerInformation, (session, builder, args) => {
    return commandList['cyl'][1](session, builder, args.concat('-h'));
}];
