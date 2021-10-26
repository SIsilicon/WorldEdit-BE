import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
class SelectionTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:making_selection';
        this.use = Tool.emptyUse;
        this.useOn = (player, session, loc) => {
            callCommand(player, player.isSneaking ? 'pos1' : 'pos2', [`${loc.x}`, `${loc.y}`, `${loc.z}`]);
        };
    }
}
Tools.register(SelectionTool, 'selection_wand');
