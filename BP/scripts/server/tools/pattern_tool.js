import { World, MinecraftBlockTypes } from 'mojang-minecraft';
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
                session.addPickerPattern(block);
                addedToPattern = true;
            }
            else {
                session.clearPickerPattern();
                session.addPickerPattern(block);
            }
            // TODO: Properly name fences, shulker boxes, polished stones, slabs, glazed terracotta, sand
            const properties = block.getAllProperties();
            if (properties.length && blockName != 'water' && blockName != 'lava') {
                for (let i = 0; i < properties.length; i++) {
                    const prop = properties[i];
                    blockName += `\n§o${prop.name}§r: ${prop.value}`;
                }
            }
            if (blockName.startsWith('minecraft:')) {
                blockName = blockName.slice('minecraft:'.length);
            }
            this.log(RawText.translate('worldedit.pattern-picker.' + (addedToPattern ? 'add' : 'set'))
                .append('text', blockName));
        };
    }
}
Tools.register(PatternPickerTool, 'pattern_picker');
class AirPicker extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:picking_air';
        this.itemTool = 'wedit:pattern_picker';
        this.use = (player, session) => {
            const dimension = getPlayerDimension(player)[1];
            let addedToPattern = true;
            if (!player.isSneaking) {
                session.clearPickerPattern();
                addedToPattern = false;
            }
            session.addPickerPattern(MinecraftBlockTypes.air.createDefaultBlockPermutation());
            this.log(RawText.translate('worldedit.pattern-picker.' + (addedToPattern ? 'add' : 'set'))
                .append('text', 'air'));
        };
    }
}
Tools.register(AirPicker, 'pattern_air_picker');
