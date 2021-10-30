import { getPlayerDimension } from '../util.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
class StackerTool extends Tool {
    constructor(size) {
        super();
        this.size = 2;
        this.tag = 'wedit:using_stacker';
        this.use = Tool.emptyUse;
        this.useOn = (player, session, loc) => {
            const [dimension, dimName] = getPlayerDimension(player);
            this.log(`Using Stacker of size ${this.size}`);
        };
        this.size = size;
    }
}
Tools.register(StackerTool, 'stacker_wand');
