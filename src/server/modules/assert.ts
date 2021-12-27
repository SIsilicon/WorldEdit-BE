import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { RawText } from './rawtext.js';
import { Regions } from './regions.js';
import { PlayerSession } from '../sessions.js';

export function assertBuilder(player: Player) {
    if (!Server.player.hasTag('builder', player.nameTag)) {
        throw RawText.translate('commands.generic.wedit:no-perms');
    }
}

export function assertClipboard(player: Player) {
    if (!Regions.has('clipboard', player)) {
        throw RawText.translate('commands.generic.wedit:no-clipboard');
    }
}

export function assertCuboidSelection(session: PlayerSession) {
    if (session.getBlocksSelected().length == 0 || session.selectionMode != 'cuboid') {
        throw RawText.translate('commands.generic.wedit:no-cuboid-region');
    }
}
