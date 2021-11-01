import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { getPlayerDimension, printDebug } from '../util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class StackerTool extends Tool {
    size = 2;
    
    tag = 'wedit:using_stacker';
    itemTool = 'wedit:stacker_wand';
    itemBase = 'minecraft:iron_axe';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        const [dimension, dimName] = getPlayerDimension(player);
        // TODO: explicitly selection mode to cuboid
        const points = session.getSelectionPoints();
        session.clearSelectionPoints();
        session.setSelectionPoint(0, loc.offset(0,0,0));
        session.setSelectionPoint(1, loc.offset(0,0,0));
        
        callCommand(player, 'stack', [`${this.size}`, 'b']);
        
        session.clearSelectionPoints();
        for (let i = 0; i < points.length; i++) {
            session.setSelectionPoint(i, points[i]);
        }
    }
    
    constructor(size: number) {
        super();
        this.size = size;
    }
}

Tools.register(StackerTool, 'stacker_wand');