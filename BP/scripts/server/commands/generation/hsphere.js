import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'hsphere',
    description: 'Generate a hollow sphere.',
    usage: '[-r] <pattern> <radii>',
};
commandList['hsphere'] = [registerInformation, (session, builder, args) => {
        return commandList['sphere'][1](session, builder, args.concat('-h'));
    }];
