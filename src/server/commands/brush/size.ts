import { RawText } from '../../modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brushes.js';

const registerInformation = {
	cancelMessage: true,
	name: 'size',
	description: 'Set the size of the brush',
	usages: [
	    '<tier: 1..6> <size: int>'
	]
};

commandList['size'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    
	if (!session.hasTool(brush)) {
		throw RawText.translate('worldedit.wand.brush.no-bind');
	}
	let sizeArg = args.shift();
	const size = parseInt(sizeArg);
	if (size != size) {
		throw RawText.translate('worldedit.error.invalid-integer').with(sizeArg ?? "' '");
	}
	session.setToolProperty(brush, 'size', size);
	return RawText.translate('worldedit.wand.generic.info');
}];