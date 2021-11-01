import { callCommand } from '../commands/command_list.js';
import { getPlayerDimension } from '../util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
class StackerTool extends Tool {
    constructor(size) {
        super();
        this.size = 2;
        this.tag = 'wedit:using_stacker';
        this.itemTool = 'wedit:stacker_wand';
        this.itemBase = 'minecraft:iron_axe';
        this.useOn = (player, session, loc) => {
            const [dimension, dimName] = getPlayerDimension(player);
            // TODO: explicitly selection mode to cuboid
            const points = session.getSelectionPoints();
            session.clearSelectionPoints();
            session.setSelectionPoint(0, loc.offset(0, 0, 0));
            session.setSelectionPoint(1, loc.offset(0, 0, 0));
            callCommand(player, 'stack', [`${this.size}`, 'b']);
            session.clearSelectionPoints();
            for (let i = 0; i < points.length; i++) {
                session.setSelectionPoint(i, points[i]);
            }
        };
        this.size = size;
    }
}
Tools.register(StackerTool, 'stacker_wand');
