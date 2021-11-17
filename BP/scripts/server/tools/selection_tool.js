import { callCommand } from '../commands/command_list.js';
import { Server } from '../../library/Minecraft.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
class SelectionTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:making_selection';
        this.itemTool = 'wedit:selection_wand';
        this.itemBase = 'minecraft:wooden_axe';
        this.useOn = (player, session, loc) => {
            callCommand(player, player.isSneaking ? 'pos1' : 'pos2', [`${loc.x}`, `${loc.y}`, `${loc.z}`]);
        };
    }
    bind(player) {
        super.bind(player);
        function giveItem(item) {
            if (Server.runCommand(`clear "${player.nameTag}" ${item} -1 0`).error) {
                Server.runCommand(`give "${player.nameTag}" ${item}`);
            }
        }
        giveItem('wedit:selection_fill');
        giveItem('wedit:pattern_picker');
        giveItem('wedit:copy_button');
        giveItem('wedit:cut_button');
        giveItem('wedit:paste_button');
        giveItem('wedit:undo_button');
        giveItem('wedit:redo_button');
        giveItem('wedit:spawn_glass');
        giveItem('wedit:config_button');
    }
}
Tools.register(SelectionTool, 'selection_wand');
