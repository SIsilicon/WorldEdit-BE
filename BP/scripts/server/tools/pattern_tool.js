import { World, MinecraftBlockTypes, BlockProperties } from 'mojang-minecraft';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { RawText } from '../modules/rawtext.js';
import { getPlayerDimension } from '../util.js';
class PatternPickerTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:picking_block_pattern';
        this.itemTool = 'wedit:pattern_picker';
        this.useOn = (player, session, loc) => {
            const dimension = getPlayerDimension(player)[1];
            let addedToPattern = false;
            let block = World.getDimension(dimension).getBlock(loc).permutation.clone();
            let blockName = block.type.id;
            if (player.isSneaking) {
                let isCauldron = false;
                if (blockName == 'minecraft:cauldron' || blockName == 'minecraft:lava_cauldron') {
                    isCauldron = true;
                    session.clearPickerPattern();
                    if (blockName == 'minecraft:lava_cauldron') {
                        block = MinecraftBlockTypes.lava.createDefaultBlockPermutation();
                        blockName = 'minecraft:flowing_lava';
                    }
                    else if (block.getProperty(BlockProperties.fillLevel).value) {
                        block = MinecraftBlockTypes.water.createDefaultBlockPermutation();
                        blockName = 'minecraft:water';
                    }
                    else {
                        block = MinecraftBlockTypes.air.createDefaultBlockPermutation();
                        blockName = 'minecraft:air';
                    }
                }
                session.addPickerPattern(block);
                addedToPattern = !isCauldron;
            }
            else {
                session.clearPickerPattern();
                session.addPickerPattern(block);
            }
            // TODO: Properly name fences, shulker boxes, polished stones, slabs, glazed terracotta, sand
            for (const prop of block.getAllProperties()) {
                if (typeof prop.value == 'string') {
                    blockName += '.' + prop.value;
                }
            }
            if (blockName.startsWith('minecraft:')) {
                blockName = blockName.slice('minecraft:'.length);
            }
            this.log(RawText.translate('worldedit.pattern-picker.' + (addedToPattern ? 'add' : 'set'))
                .append('translate', `tile.${blockName}.name`));
        };
    }
}
Tools.register(PatternPickerTool, 'pattern_picker');
