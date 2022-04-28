import { Player, BlockLocation, Dimension } from 'mojang-minecraft';
import { Server, Vector, RawText } from '@notbeer-api';
import { PlayerSession } from '../sessions.js';
import { canPlaceBlock } from '../util.js';
import { History } from './history.js';

function assertPermission(player: Player, perm: string) {
    if (!Server.player.hasPermission(player, perm)) {
        throw 'commands.generic.wedit:noPermission';
    }
}

function assertCanBuildWithin(dim: Dimension, min: BlockLocation, max: BlockLocation) {
    const minChunk = Vector.from(min).mul(1/16).floor().mul(16);
    const maxChunk = Vector.from(max).mul(1/16).ceil().mul(16);
    
    for (let z = minChunk.z; z < maxChunk.z; z += 16)
    for (let x = minChunk.x; x < maxChunk.x; x += 16) {
        if (!canPlaceBlock(new BlockLocation(x, 0, z), dim)) {
            throw RawText.translate('commands.generic.wedit:outsideWorld');
        }
    }
}

function assertClipboard(session: PlayerSession) {
    if (!session.clipboard) {
        throw RawText.translate('commands.generic.wedit:noClipboard');
    }
}

function assertSelection(session: PlayerSession) {
    if (session.getSelectedBlockCount() == 0) {
        throw RawText.translate('commands.generic.wedit:noSelection');
    }
}

function assertCuboidSelection(session: PlayerSession) {
    if (session.getSelectedBlockCount() == 0 || (session.selectionMode != 'cuboid' && session.selectionMode != 'extend')) {
        throw RawText.translate('commands.generic.wedit:noCuboidSelection');
    }
}

// TODO: Localize
function assertHistoryNotRecording(history: History) {
    if (history.isRecording()) {
        throw RawText.translate('History is still being recorded!');
    }
}

export { assertCanBuildWithin, assertClipboard, assertCuboidSelection, assertHistoryNotRecording, assertPermission, assertSelection }
