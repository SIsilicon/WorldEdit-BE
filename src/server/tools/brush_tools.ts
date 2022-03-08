import { BlockLocation, Player } from 'mojang-minecraft';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { Brush } from '../brushes/base_brush.js';
import { PlayerSession } from '../sessions.js';

class BrushTool extends Tool {
    public brush: Brush;
    
    public range: number = null;
    public mask: Mask = null;
    public traceMask: Mask = null;
    
    permission = 'worldedit.brush';
    
    use = (player: Player, session: PlayerSession) => {
        const hit = PlayerUtil.traceForBlock(player, this.range, this.traceMask);
        if (!hit) {
            throw 'commands.wedit:jumpto.none';
        }
        this.brush.apply(hit, session, this.mask);
    }
    
    constructor(brush: Brush, mask?: Mask) {
        super();
        this.brush = brush;
        this.mask = mask;
    }
    
    set size(value: number) {
        this.brush.resize(value);
    }
    
    set material(value: Pattern) {
        this.brush.paintWith(value);
    }
}
Tools.register(BrushTool, 'brush')
