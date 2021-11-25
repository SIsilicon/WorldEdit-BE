import { RawText } from '../../modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brushes.js';

const registerInformation = {
	cancelMessage: true,
	name: 'range',
	description: 'Set how far the brush will look for a block to apply on',
	usages: [
	    '<tier: 1..6> <range: int>'
	]
};

commandList['range'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    
	if (!session.hasTool(brush)) {
		throw RawText.translate('worldedit.wand.brush.no-bind');
	}
	let rangeArg = args.shift();
	const range = parseInt(rangeArg);
	if (range != range) {
		throw RawText.translate('worldedit.error.invalid-integer').with(rangeArg ?? "' '");
	}
	session.setToolProperty(brush, 'range', range);
	return RawText.translate('worldedit.wand.generic.info');
}];