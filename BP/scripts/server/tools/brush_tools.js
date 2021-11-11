import { RawText } from '../modules/rawtext.js';
import { raytrace } from '../modules/raytrace.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { requestPlayerDirection, getPlayerDimension, printerr } from '../util.js';
import { PLAYER_HEIGHT } from '../../config.js';
class BrushTool extends Tool {
    constructor(brush) {
        super();
        this.use = (player, session) => {
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
        };
        this.brush = brush;
    }
    set size(value) {
        this.brush.resize(value);
    }
}
class WoodenBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_wooden_brush';
        this.itemTool = 'wedit:wooden_brush';
        this.itemBase = 'minecraft:wooden_shovel';
    }
}
Tools.register(WoodenBrushTool, 'wooden_brush');
class StoneBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_stone_brush';
        this.itemTool = 'wedit:stone_brush';
        this.itemBase = 'minecraft:stone_shovel';
    }
}
Tools.register(StoneBrushTool, 'stone_brush');
class IronBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_iron_brush';
        this.itemTool = 'wedit:iron_brush';
        this.itemBase = 'minecraft:iron_shovel';
    }
}
Tools.register(IronBrushTool, 'iron_brush');
class GoldenBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_golden_brush';
        this.itemTool = 'wedit:golden_brush';
        this.itemBase = 'minecraft:golden_shovel';
    }
}
Tools.register(GoldenBrushTool, 'golden_brush');
class DiamondBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_diamond_brush';
        this.itemTool = 'wedit:diamond_brush';
        this.itemBase = 'minecraft:diamond_shovel';
    }
}
Tools.register(DiamondBrushTool, 'diamond_brush');
class NetheriteBrushTool extends BrushTool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:use_netherite_brush';
        this.itemTool = 'wedit:netherite_brush';
        this.itemBase = 'minecraft:netherite_shovel';
    }
}
Tools.register(NetheriteBrushTool, 'netherite_brush');
