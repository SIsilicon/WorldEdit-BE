import { BlockLocation, Player } from 'mojang-minecraft';
import { Vector } from '@modules/vector.js';
import { RawText } from '@modules/rawtext.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { Brush } from '../brushes/base_brush.js';
import { PlayerSession } from '../sessions.js';
import { printerr } from '../util.js';

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
    
    set material(value: Pattern) {
        this.brush.paintWith(value);
    }
    
    use = (player: Player, session: PlayerSession) => {
        const hit = PlayerUtil.traceForBlock(player, this.range, this.traceMask);
        if (!hit) {
            throw RawText.translate('commands.wedit:jumpto.none');
        }
        this.brush.apply(hit, session, this.mask);
    }
    
    permission = 'worldedit.brush';
    
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
