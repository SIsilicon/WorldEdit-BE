import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { getPlayerDimension } from '../util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class StackerTool extends Tool {
    size = 2;
    
    tag = 'wedit:using_stacker';
    use = Tool.emptyUse;
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        const [dimension, dimName] = getPlayerDimension(player);
        this.log(`Using Stacker of size ${this.size}`);
    }
    
    constructor(size: number) {
        super();
        this.size = size;
    }
}
Tools.register(StackerTool, 'stacker_wand');