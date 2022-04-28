import { Cardinal } from '@modules/directions.js';
import { Mask } from '@modules/mask.js';
import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class StackerTool extends Tool {
    public range: number;
    public mask: Mask;
    
    permission = 'worldedit.region.stack';
    useOn = function (self: Tool, player: Player, session: PlayerSession, loc: BlockLocation) {
        const dim = player.dimension;
        const dir = new Cardinal(Cardinal.Dir.BACK).getDirection(player);
        const start = loc.offset(dir.x, dir.y, dir.z);
        if (!this.mask.matchesBlock(start, dim)) {
            return;
        }
        let end = loc;
        for (var i = 0; i < this.range; i++) {
            end = end.offset(dir.x, dir.y, dir.z);
            if (!this.mask.matchesBlock(end.offset(dir.x, dir.y, dir.z), dim)) break;
        }
        const history = session.getHistory();
        const record = history.record();
        const tempStack = session.createRegion(true);
        try {
            history.addUndoStructure(record, start, end, 'any');
            
            tempStack.save(loc, loc, dim);
            for (const pos of start.blocksBetween(end)) {
                tempStack.load(pos, dim);
            }
            history.addRedoStructure(record, start, end, 'any');
            history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            session.deleteRegion(tempStack);
        }
    }
    
    constructor(range: number, mask: Mask) {
        super();
        this.range = range;
        this.mask = mask;
    }
}

Tools.register(StackerTool, 'stacker_wand');