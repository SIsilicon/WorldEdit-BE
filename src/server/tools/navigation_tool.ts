import { Player } from 'mojang-minecraft';
import { getPlayerDimension, getPlayerBlockLocation } from '../util.js';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class NavigationTool extends Tool {
    tag = 'wedit:navigating';
    itemTool = 'wedit:navigation_wand';
    itemBase = 'minecraft:compass';
    use = (player: Player, session: PlayerSession) => {
        const dimension = getPlayerDimension(player)[0];
        if (!dimension.isEmpty(getPlayerBlockLocation(player).offset(0, 1, 0))) {
            callCommand(player, 'unstuck', []);
        } else if (player.isSneaking) {
            callCommand(player, 'thru', []);
        } else {
            callCommand(player, 'jumpto', []);
        }
    }
}
Tools.register(NavigationTool, 'navigation_wand');