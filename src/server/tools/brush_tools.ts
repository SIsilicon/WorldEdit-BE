import { BlockLocation, Player } from 'mojang-minecraft';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { Brush } from '../brushes/base_brush.js';
import { PlayerSession } from '../sessions.js';
import { log } from '@library/utils/console.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';

class BrushTool extends Tool {
    public brush: Brush;
    
    public range: number = null;
    public mask: Mask = null;
    public traceMask: Mask = null;
    
    permission = 'worldedit.brush';
    
    use = function* (self: BrushTool, player: Player, session: PlayerSession) {
        const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
        if (!hit) {
            throw 'commands.wedit:jumpto.none';
        }
        log(self.brush);
        yield* self.brush.apply(hit, session, self.mask);
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
