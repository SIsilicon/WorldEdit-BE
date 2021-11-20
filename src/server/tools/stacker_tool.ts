import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Regions } from '../modules/regions.js';
import { Mask } from '../modules/mask.js';
import { getCardinalDirection } from '../modules/directions.js';
import { PlayerUtil } from '../modules/player_util.js';
import { printDebug, printerr } from '../util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class StackerTool extends Tool {
    range: number;
    mask: Mask;
    
    tag = 'wedit:using_stacker';
    itemTool = 'wedit:stacker_wand';
    itemBase = 'minecraft:iron_axe';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        const [dimension, dimName] = PlayerUtil.getDimension(player);
        const dir = getCardinalDirection('back', player);
        const start = loc.offset(...dir);
        if (!this.mask.matchesBlock(start, dimName)) {
            printDebug('stacked nothing');
            return;
        }
        let end = loc;
        for (var i = 0; i < this.range; i++) {
            end = end.offset(...dir);
            if (!this.mask.matchesBlock(end.offset(...dir), dimName)) break;
        }
        const history = session.getHistory();
        history.record();
        history.addUndoStructure(start, end, 'any');
        
        Regions.save('temp_stack', loc, loc, player);
        for (const pos of start.blocksBetween(end)) {
            Regions.load('temp_stack', pos, player, 'absolute');
        }
        Regions.delete('temp_stack', player);
        
        history.addRedoStructure(start, end, 'any');
        history.commit();
    }
    
    constructor(range: number, mask: Mask) {
        super();
        this.range = range;
        this.mask = mask;
    }
}

Tools.register(StackerTool, 'stacker_wand');