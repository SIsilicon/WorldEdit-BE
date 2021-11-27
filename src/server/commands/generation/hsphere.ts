import { Server } from '../../../library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
	cancelMessage: true,
	name: 'hsphere',
	description: 'Generate a hollow sphere.',
	usages: [
		'[-r] <pattern: Pattern> <radii: float>',
		'[-r] <pattern: Pattern> <radiiXZ: float>,<radiiY: float>',
		'[-r] <pattern: Pattern> <radiiX: float>,<radiiY: float>,<radiiZ: float>'
	]
};

commandList['hsphere'] = [registerInformation, (session, builder, args) => {
	return commandList['sphere'][1](session, builder, args.concat('-h'));
}];
