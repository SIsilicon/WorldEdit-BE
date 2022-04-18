import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Mask } from '@modules/mask.js';
import { RawText } from '@library/Minecraft.js';
import { Regions } from '@modules/regions.js';
import { MinecraftBlockTypes } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'copy',
    permission: 'worldedit.clipboard.copy',
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
    assertCuboidSelection(session);
    const player = session.getPlayer();
    const dimension = player.dimension;
    const [start, end] = session.getSelectionRange();
    assertCanBuildWithin(dimension, start, end);
    
    let includeEntities: boolean = args.get('_using_item') ? session.includeEntities : args.has('e');
    let includeAir: boolean = args.get('_using_item') ? session.includeAir : !args.has('a');
    let mask: Mask = args.has('m') ? args.get('m-mask') : undefined;
    
    // Create a temporary copy since we'll be adding void/air blocks to the selection.
    let tempUsed = !includeAir || mask;
    if (tempUsed) {
        Regions.save('tempCopy', start, end, player);
        
        const voidBlock = MinecraftBlockTypes.structureVoid.createDefaultBlockPermutation();
        const airBlock = MinecraftBlockTypes.air.createDefaultBlockPermutation();
        
        for (const block of start.blocksBetween(end)) {
            let wasAir = dimension.getBlock(block).id == 'minecraft:air';
            let isAir = wasAir || (mask ? !mask.matchesBlock(block, dimension) : false);
            if (includeAir && mask && !wasAir && isAir) {
                dimension.getBlock(block).setPermutation(airBlock);
            } else if (!includeAir && isAir) {
                dimension.getBlock(block).setPermutation(voidBlock);
            }
        }
    }
    
    const error = Regions.save('clipboard', start, end, player, includeEntities);
    
    if (tempUsed) {
        Regions.load('tempCopy', start, player);
        Regions.delete('tempCopy', player);
    }
    
    return error;
}

registerCommand(registerInformation, function (session, builder, args) {
    if (copy(session, args)) {
        throw RawText.translate('commands.generic.wedit:commandFail');
    }
    return RawText.translate('commands.wedit:copy.explain').with(`${session.getSelectedBlockCount()}`);
});
