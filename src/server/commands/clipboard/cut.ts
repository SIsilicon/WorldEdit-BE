import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';

import { getSession } from '../../sessions.js';
import { regionMin, regionMax, getPlayerDimension } from '../../util.js';
import { copy } from './copy.js';
import { set } from '../region/set.js';
import { Pattern } from '../../modules/pattern.js';
import { Mask } from '../../modules/mask.js'
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
    cancelMessage: true,
    name: 'cut',
    description: 'Remove your current selection and places it in the clipboard.',
    usage: '[-ae] [fill: Pattern] [-m <mask: Mask>]',
};

commandList['cut'] = [registerInformation, (session, builder, args) => {
    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = regionMin(pos1, pos2);
        var end = regionMax(pos1, pos2);
        history.addUndoStructure(start, end, 'any');
    }
    
    if (copy(session, args)) {
        throw RawText.translate('worldedit.error.command-fail');
    }

    let pattern: string;
    let mask: Mask;
    let includeEntities = false;
	for (let i = 0; i < args.length; i++) {
		if (args[i].charAt(0) == '-') {
			for (const c of args[i]) {
				if (c == 'e') {
					includeEntities = true;
				} else if (c == 'm') {
					mask = Mask.parseArg(args[i+1] ?? '');
					i++;
				}
			}
		} else if (!pattern) {
			pattern = args[i];
		}
	}
	pattern = pattern ?? 'air';

    set(session, Pattern.parseArg(pattern), mask);
    if (includeEntities) {
    	const [dim, dimName] = getPlayerDimension(builder);
    	for (const block of start.blocksBetween(end)) {
    		for (const entity of dim.getEntitiesAtBlockLocation(block)) {
    			entity.nameTag = 'wedit:marked_for_deletion';
    		}
    	}
    	Server.runCommand('execute @e[name=wedit:marked_for_deletion] ~~~ tp @s ~ -256 ~', dimName);
    	Server.runCommand('kill @e[name=wedit:marked_for_deletion]', dimName);
    }

    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();
    
    return RawText.translate('worldedit.cut.explain').with(`${session.getBlocksSelected().length}`);
}];
