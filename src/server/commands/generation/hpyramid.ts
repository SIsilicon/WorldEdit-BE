import { Server } from '../../../library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'hpyramid',
    description: 'Generate a hollow pyramid.',
    usage: '<pattern: Pattern> <size: int>',
};

commandList['hpyramid'] = [registerInformation, (session, builder, args) => {
    return commandList['pyramid'][1](session, builder, args.concat('-h'));
}];
