import { Player, MinecraftBlockTypes } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { getSession, PlayerSession } from '../../sessions.js';
import { Regions } from '@modules/regions.js';
import { Mask } from '@modules/mask.js';
import { PlayerUtil } from '@modules/player_util.js';
import { printLocation } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'copy',
    description: 'commands.wedit:copy.description',
    usage: [
        {
            flag: 'a'
        }, {
            flag: 'e'
        }, {
            flag: 'm',
            name: 'mask',
            type: 'Mask'
        }
    ]
};

/**
 * Performs the ;copy command.
 * @remark This function is only exported so as to not duplicate code for the ;cut command.
 * @param session The session whose player is running this command
 * @param args The arguments that change how the copying will happen
 */
export function copy(session: PlayerSession, args = new Map<string, any>()) {
    const player = session.getPlayer();
    const [pos1, pos2] = session.getSelectionPoints().slice(0, 2);
    if (session.getBlocksSelected().length == 0) throw RawText.translate('worldedit.error.incomplete-region');
    
    let includeEntities: boolean = session.usingItem ? session.includeEntities : args.has('e');
    let includeAir: boolean = session.usingItem ? session.includeAir : !args.has('a');
    let mask: Mask = args.has('m') ? args.get('m-mask') : undefined;
    
    // Create a temporary copy since we'll be adding void/air blocks to the selection.
    let tempUsed = !includeAir || mask;
    if (tempUsed) {
        Regions.save('tempCopy', pos1, pos2, player);
        
        const [dimension, dimName] = PlayerUtil.getDimension(player);
        const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
        const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
        
        for (const block of pos1.blocksBetween(pos2)) {
            let wasAir = dimension.getBlock(block).id == 'minecraft:air';
            let isAir = wasAir || (mask ? !mask.matchesBlock(block, dimName) : false);
            if (includeAir && mask && !wasAir && isAir) {
                dimension.getBlock(block).setPermutation(airBlock);
            } else if (!includeAir && isAir) {
                dimension.getBlock(block).setPermutation(voidBlock);
            }
        }
    }
    
    const error = Regions.save('clipboard', pos1, pos2, player, includeEntities);
    
    if (tempUsed) {
        Regions.load('tempCopy', Vector.min(pos1, pos2).toBlock(), player);
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
