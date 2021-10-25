import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';

import { getSession, PlayerSession } from '../../sessions.js';
import { Regions } from '../../modules/regions.js';
import { printLocation, regionSize } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

// TODO: Ability to copy entities to clipboard
const registerInformation = {
    cancelMessage: true,
    name: 'copy',
    description: 'Copy your current selection to the clipboard',
    usage: '',
};

export function copy(session: PlayerSession) {
    const [pos1, pos2] = session.getSelectionPoints().slice(0, 2);
    if (session.getBlocksSelected().length == 0) throw RawText.translate('worldedit.error.incomplete-region');
    return Regions.save('clipboard', pos1, pos2, session.getPlayer());
}

commandList['copy'] = [registerInformation, (session, builder, args) => {
    if (copy(session)) {
        throw RawText.translate('worldedit.error.command-fail');
    }
    return RawText.translate('worldedit.copy.explain').with(`${session.getBlocksSelected().length}`);
}];
