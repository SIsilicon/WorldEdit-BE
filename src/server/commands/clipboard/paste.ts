import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';
import { getSession } from '../../sessions.js';

import { Regions } from '../../modules/regions.js';
import { addLocations, getPlayerBlockLocation, printLocation, subtractLocations } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
	cancelMessage: true,
	name: 'paste',
	description: 'Paste your clipboard in to the world',
	usage: '[-osn]',
};

commandList['paste'] = [registerInformation, (session, builder, args) => {
	if (!Regions.has('clipboard', builder)) {
		throw RawText.translate('worldedit.error.empty-clipboard');
	}
	
	let setSelection = false;
	let pasteOriginal = false;
	let pasteContent = true;
	for (let i = 0; i < args.length; i++) {
		if (args[i].charAt(0) == '-') {
			for (const c of args[i]) {
				if (c == 's') {
					setSelection = true;
				} else if (c == 'o') {
					pasteOriginal = true;
				} else if (c == 'n') {
					setSelection = true;
					pasteContent = false;
				}
			}
		}
	}
	
	let loc, pasteStart: BlockLocation;
	if (pasteOriginal) {
		pasteStart = Regions.getPosition('clipboard', builder);
		loc = pasteStart;
	} else {
		loc = getPlayerBlockLocation(builder);
		pasteStart = subtractLocations(loc, Regions.getOrigin('clipboard', builder))
	}
	let pasteEnd = addLocations(pasteStart, subtractLocations(Regions.getSize('clipboard', builder), new BlockLocation(1, 1, 1)));
	
	if (pasteContent) {
		const history = session.getHistory();
		history.record();
		history.addUndoStructure(pasteStart, pasteEnd, 'any');
		
		if (Regions.load('clipboard', loc, builder, pasteOriginal ? 'absolute' : 'relative')) {
			history.cancel();
			throw RawText.translate('worldedit.error.command-fail');
		}
		
		history.addRedoStructure(pasteStart, pasteEnd, 'any');
		history.commit();
	}
	
	if (setSelection) {
		// TODO: Set selection to cuboid
		session.clearSelectionPoints();
		session.setSelectionPoint(0, pasteStart);
		session.setSelectionPoint(1, pasteEnd);
	}
	
	if (pasteContent) {
		return RawText.translate('worldedit.paste.explain').with(`${Regions.getBlockCount('clipboard', builder)}`);
	}
	return '';
}];
