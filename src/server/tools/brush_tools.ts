import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { RawText } from '../modules/rawtext.js';
import { raytrace } from '../modules/raytrace.js';
import { Mask } from '../modules/mask.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { Brush } from '../brushes/base_brush.js';
import { requestPlayerDirection, getPlayerDimension, getPlayerBlockLocation, printerr } from '../util.js';
import { PLAYER_HEIGHT } from '../../config.js';

abstract class BrushTool extends Tool {
	public brush: Brush;
	
	public range: number;
	public mask: Mask;
	public traceMask: Mask;
	
	abstract readonly tag: string;
	abstract readonly itemTool: string;
	
	set size(value: number) {
		this.brush.resize(value);
	}
	
	use = (player: Player, session: PlayerSession) => {
		const dimension = PlayerUtil.getDimension(player)[1];
		const origin = player.location;
		origin.y += PLAYER_HEIGHT;
		PlayerUtil.requestDirection(player).then(dir => {
			const hit = raytrace(dimension, origin, dir, this.range, this.traceMask);
			if (!hit) {
				throw RawText.translate('worldedit.jumpto.none');
			}
			this.brush.apply(hit, session, this.mask);
		}).catch(e => {
			printerr(e, player, true);
		});
	}
	
	constructor(brush: Brush) {
		super();
		this.brush = brush;
	}
}

class WoodenBrushTool extends BrushTool {
	tag = 'wedit:use_wooden_brush';
	itemTool = 'wedit:wooden_brush';
	itemBase = 'minecraft:wooden_shovel';
}
Tools.register(WoodenBrushTool, 'wooden_brush');

class StoneBrushTool extends BrushTool {
	tag = 'wedit:use_stone_brush';
	itemTool = 'wedit:stone_brush';
	itemBase = 'minecraft:stone_shovel';
}
Tools.register(StoneBrushTool, 'stone_brush');

class IronBrushTool extends BrushTool {
	tag = 'wedit:use_iron_brush';
	itemTool = 'wedit:iron_brush';
	itemBase = 'minecraft:iron_shovel';
}
Tools.register(IronBrushTool, 'iron_brush');

class GoldenBrushTool extends BrushTool {
	tag = 'wedit:use_golden_brush';
	itemTool = 'wedit:golden_brush';
	itemBase = 'minecraft:golden_shovel';
}
Tools.register(GoldenBrushTool, 'golden_brush');

class DiamondBrushTool extends BrushTool {
	tag = 'wedit:use_diamond_brush';
	itemTool = 'wedit:diamond_brush';
	itemBase = 'minecraft:diamond_shovel';
}
Tools.register(DiamondBrushTool, 'diamond_brush');

class NetheriteBrushTool extends BrushTool {
	tag = 'wedit:use_netherite_brush';
	itemTool = 'wedit:netherite_brush';
	itemBase = 'minecraft:netherite_shovel';
}
Tools.register(NetheriteBrushTool, 'netherite_brush');