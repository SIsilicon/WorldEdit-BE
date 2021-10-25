import { Player } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { RawText } from './rawtext.js';

export function assertBuilder(player: Player) {
    if (!Server.player.hasTag('builder', player.nameTag)) {
        throw RawText.translate('worldedit.error.no-permission');
    }
}

export function assertNoArgs(args: string[]) {
    if (args.length > 0) {
        throw RawText.translate('worldedit.error.expect-no-args');
    }
}

export function assertValidInteger(number: number, original: string) {
    if (isNaN(number)) {
        throw RawText.translate('worldedit.error.invalid-integer').with(original);
    }
}

export function assertPositiveInt(number: number) {
    if (number <= 0) {
        throw RawText.translate('worldedit.error.not-positive').with(`${number}`);
    }
}
