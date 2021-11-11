import { MinecraftBlockTypes } from 'mojang-minecraft';
import { Regions } from '../../modules/regions.js';
import { Mask } from '../../modules/mask.js';
import { regionMin, getPlayerDimension } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';
// TODO: Ability to copy entities to clipboard
const registerInformation = {
    cancelMessage: true,
    name: 'copy',
    description: 'Copy your current selection to the clipboard',
    usage: '[-ea] [-m <mask: Mask>]',
};
export function copy(session, args) {
    const player = session.getPlayer();
    const [pos1, pos2] = session.getSelectionPoints().slice(0, 2);
    if (session.getBlocksSelected().length == 0)
        throw RawText.translate('worldedit.error.incomplete-region');
    let includeEntities = false;
    let includeAir = true;
    let mask;
    for (let i = 0; i < args.length; i++) {
        if (args[i].charAt(0) == '-') {
            for (const c of args[i]) {
                if (c == 'e') {
                    includeEntities = true;
                }
                else if (c == 'a') {
                    includeAir = false;
                }
                else if (c == 'm') {
                    mask = Mask.parseArg(args[i + 1] ?? '');
                }
            }
        }
    }
    let tempUsed = !includeAir || mask;
    if (tempUsed) {
        Regions.save('tempCopy', pos1, pos2, player);
        const [dimension, dimName] = getPlayerDimension(player);
        const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
        const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
        for (const block of pos1.blocksBetween(pos2)) {
            let wasAir = dimension.getBlock(block).id == 'minecraft:air';
            let isAir = wasAir || (mask ? !mask.matchesBlock(block, dimName) : false);
            if (includeAir && mask && !wasAir && isAir) {
                dimension.getBlock(block).setPermutation(airBlock);
            }
            else if (!includeAir && isAir) {
                dimension.getBlock(block).setPermutation(voidBlock);
            }
        }
    }
    const error = Regions.save('clipboard', pos1, pos2, player, includeEntities);
    if (tempUsed) {
        Regions.load('tempCopy', regionMin(pos1, pos2), player, 'absolute');
        Regions.delete('tempCopy', player);
    }
    return error;
}
commandList['copy'] = [registerInformation, (session, builder, args) => {
        if (copy(session, args)) {
            throw RawText.translate('worldedit.error.command-fail');
        }
        return RawText.translate('worldedit.copy.explain').with(`${session.getBlocksSelected().length}`);
    }];
