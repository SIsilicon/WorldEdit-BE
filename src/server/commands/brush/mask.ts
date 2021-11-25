import { Mask } from '../../modules/mask.js';
import { RawText } from '../../modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brushes.js';

const registerInformation = {
	cancelMessage: true,
	name: 'mask',
	description: 'Set what blocks a brush can affect',
	usages: [
	    '<tier: 1..6> [mask: Mask]'
	]
};

commandList['mask'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    
	if (!session.hasTool(brush)) {
		throw RawText.translate('worldedit.wand.brush.no-bind');
	}
	const mask = Mask.parseArg(args.shift() ?? '');
	session.setToolProperty(brush, 'mask', mask);
	return RawText.translate('worldedit.wand.generic.info');
}];