import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class SelectionTool extends Tool {
    tag = 'wedit:making_selection';
    use = Tool.emptyUse;
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        callCommand(player, player.isSneaking ? 'pos1' : 'pos2',
            [`${loc.x}`, `${loc.y}`, `${loc.z}`]
        );
    }
}
Tools.register(SelectionTool, 'selection_wand');