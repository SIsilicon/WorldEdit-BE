import { Server } from '../../library/Minecraft.js';
import { RawText } from './rawtext.js';
export function assertBuilder(player) {
    if (!Server.player.hasTag('builder', player.nameTag)) {
        throw RawText.translate('worldedit.error.no-permission');
    }
}
export function assertNoArgs(args) {
    if (args.length > 0) {
        throw RawText.translate('worldedit.error.expect-no-args');
    }
}
export function assertValidInteger(number, original) {
    if (isNaN(number)) {
        throw RawText.translate('worldedit.error.invalid-integer').with(original);
    }
}
export function assertPositiveInt(number) {
    if (number <= 0) {
        throw RawText.translate('worldedit.error.not-positive').with(`${number}`);
    }
}
