import { World, MinecraftBlockTypes, BlockPermutation, BlockProperties, BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';

class PatternPickerTool extends Tool {
    tag = 'wedit:picking_pattern';
    itemTool = 'wedit:pattern_picker';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        const dimension = PlayerUtil.getDimension(player)[1];
        let addedToPattern = false;
        let block = World.getDimension(dimension).getBlock(loc).permutation.clone();
        let blockName = block.type.id;
        if (player.isSneaking) {
            session.globalPattern.addBlock(block);
            addedToPattern = true;
        } else {
            session.globalPattern.clear();
            session.globalPattern.addBlock(block);
        }
        
        blockName += printBlockProperties(block);
        if (blockName.startsWith('minecraft:')) {
            blockName = blockName.slice('minecraft:'.length);
        }
        this.log(RawText.translate('worldedit.patternPicker.' + (addedToPattern ? 'add' : 'set'))
            .append('text', blockName)
        );
    }
    use = (player: Player, session: PlayerSession) => {
        const dimension = PlayerUtil.getDimension(player)[1];
        let addedToPattern = true;
        if (!player.isSneaking) {
            session.globalPattern.clear();
            addedToPattern = false;
        }
        session.globalPattern.addBlock(MinecraftBlockTypes.air.createDefaultBlockPermutation());
        this.log(RawText.translate('worldedit.patternPicker.' + (addedToPattern ? 'add' : 'set'))
            .append('text', 'air')
        );
    }
}
Tools.register(PatternPickerTool, 'pattern_picker');

class MaskPickerTool extends Tool {
    tag = 'wedit:picking_mask';
    itemTool = 'wedit:mask_picker';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        const dimension = PlayerUtil.getDimension(player)[1];
        let addedToPattern = false;
        let block = World.getDimension(dimension).getBlock(loc).permutation.clone();
        let blockName = block.type.id;
        if (player.isSneaking) {
            session.globalMask.addBlock(block);
            addedToPattern = true;
        } else {
            session.globalMask.clear();
            session.globalMask.addBlock(block);
        }
        
        blockName += printBlockProperties(block);
        if (blockName.startsWith('minecraft:')) {
            blockName = blockName.slice('minecraft:'.length);
        }
        this.log(RawText.translate('worldedit.maskPicker.' + (addedToPattern ? 'add' : 'set'))
            .append('text', blockName)
        );
    }
    use = (player: Player, session: PlayerSession) => {
        const dimension = PlayerUtil.getDimension(player)[1];
        let addedToPattern = true;
        if (!player.isSneaking) {
            session.globalMask.clear();
            addedToPattern = false;
        }
        session.globalMask.addBlock(MinecraftBlockTypes.air.createDefaultBlockPermutation());
        this.log(RawText.translate('worldedit.maskPicker.' + (addedToPattern ? 'add' : 'set'))
            .append('text', 'air')
        );
    }
}
Tools.register(MaskPickerTool, 'mask_picker');

function printBlockProperties(block: BlockPermutation) {
    let propString = '';
    const properties = block.getAllProperties();
    if (properties.length && block.type.id != 'water' && block.type.id != 'lava') {
        for (let i = 0; i < properties.length; i++) {
            const prop = properties[i];
            if (prop.name.startsWith('wall_connection_type') || prop.name.startsWith('liquid_depth')) {
                continue;
            }
            
            const val = typeof prop.value == 'string' ? `'${prop.value}'` : prop.value;
            propString += `\n§o${prop.name}§r: ${val}`;
        }
    }
    return propString;
}