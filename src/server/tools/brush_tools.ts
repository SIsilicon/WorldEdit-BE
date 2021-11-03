import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js'
import { PlayerSession } from '../sessions.js';
import { RawText } from '../modules/rawtext.js';
import { raytrace } from '../modules/raytrace.js'
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { requestPlayerDirection, getPlayerDimension } from '../util.js';
import { PLAYER_HEIGHT } from '../../config.js';

abstract class BrushTool extends Tool {
    brush: string;
    
    abstract readonly tag: string;
    abstract readonly itemTool: string;
    
    use = (player: Player, session: PlayerSession) => {
        const [dimension, dimName] = getPlayerDimension(player);
        const origin = player.location;
        origin.y += PLAYER_HEIGHT;
        requestPlayerDirection(player).then(dir => {
            const hit = raytrace(dimension, origin, dir);
            if (!hit) {
                throw RawText.translate('worldedit.jumpto.none');
            }
            this.log(`Doing something with ${this.itemTool} : ${this.brush}`);
        });
    }
    
    constructor(brush: string) {
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