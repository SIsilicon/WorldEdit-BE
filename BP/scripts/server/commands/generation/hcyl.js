import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'hcyl',
    description: 'Generate a hollow cylinder.',
    usage: '[-r] <pattern> <radii> [height]',
};
commandList['hcyl'] = [registerInformation, (session, builder, args) => {
        return commandList['cyl'][1](session, builder, args.concat('-h'));
    }];
