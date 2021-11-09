import { World, MinecraftBlockTypes, BlockProperties, BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { RawText } from '../modules/rawtext.js';
import { getPlayerDimension } from '../util.js';

class PatternPickerTool extends Tool {
	tag = 'wedit:picking_block_pattern';
	itemTool = 'wedit:pattern_picker';
	useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
		const dimension = getPlayerDimension(player)[1];
		let addedToPattern = false;
		let block = World.getDimension(dimension).getBlock(loc).permutation.clone();
		let blockName = block.type.id;
		if (player.isSneaking) {
			session.addPickerPattern(block);
			addedToPattern = true;
		} else {
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
			.append('text', blockName)
		);
	}
}
Tools.register(PatternPickerTool, 'pattern_picker');

class AirPicker extends Tool {
	tag = 'wedit:picking_air';
	itemTool = 'wedit:pattern_picker';
	use = (player: Player, session: PlayerSession) => {
		const dimension = getPlayerDimension(player)[1];
		let addedToPattern = true;
		if (!player.isSneaking) {
			session.clearPickerPattern();
			addedToPattern = false;
		}
		session.addPickerPattern(MinecraftBlockTypes.air.createDefaultBlockPermutation());
		this.log(RawText.translate('worldedit.pattern-picker.' + (addedToPattern ? 'add' : 'set'))
			.append('text', 'air')
		);
	}
}
Tools.register(AirPicker, 'pattern_air_picker');
