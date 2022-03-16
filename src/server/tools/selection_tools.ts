import { BlockLocation, Player, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class SelectionTool extends Tool {
    permission = 'worldedit.selection.pos';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        callCommand(player, player.isSneaking ? 'pos1' : 'pos2',
            [`${loc.x}`, `${loc.y}`, `${loc.z}`]
        );
    }
}
Tools.register(SelectionTool, 'selection_wand');

class FarSelectionTool extends Tool {
    permission = 'worldedit.selection.hpos';
    use = (player: Player, session: PlayerSession) => {
        callCommand(player, player.isSneaking ? 'hpos1' : 'hpos2');
    }
}
Tools.register(FarSelectionTool, 'far_selection_wand');