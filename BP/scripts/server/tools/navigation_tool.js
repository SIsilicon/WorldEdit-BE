import { getPlayerDimension, getPlayerBlockLocation } from '../util.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
class NavigationTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:navigating';
        this.itemTool = 'wedit:navigation_wand';
        this.itemBase = 'minecraft:compass';
        this.use = (player, session) => {
            const dimension = PlayerUtil.getDimension(player)[0];
            if (!dimension.isEmpty(PlayerUtil.getBlockLocation(player).offset(0, 1, 0))) {
                callCommand(player, 'unstuck', []);
            }
            else if (player.isSneaking) {
                callCommand(player, 'thru', []);
            }
            else {
                callCommand(player, 'jumpto', []);
            }
        };
    }
}
Tools.register(NavigationTool, 'navigation_wand');
