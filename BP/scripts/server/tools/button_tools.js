import { Server } from '../../library/Minecraft.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';
import { RawText } from '../modules/rawtext.js';
class CommandButton extends Tool {
    constructor() {
        super(...arguments);
        this.use = (player, session) => {
            session.usingItem = true;
            callCommand(player, this.command);
            session.usingItem = false;
        };
    }
}
class CutTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_cut';
        this.command = 'cut';
        this.itemTool = 'wedit:cut_button';
    }
}
Tools.register(CutTool, 'cut');
class CopyTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_copy';
        this.command = 'copy';
        this.itemTool = 'wedit:copy_button';
    }
}
Tools.register(CopyTool, 'copy');
class PasteTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_paste';
        this.command = 'paste';
        this.itemTool = 'wedit:paste_button';
    }
}
Tools.register(PasteTool, 'paste');
class UndoTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_undo';
        this.command = 'undo';
        this.itemTool = 'wedit:undo_button';
    }
}
Tools.register(UndoTool, 'undo');
class RedoTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_redo';
        this.command = 'redo';
        this.itemTool = 'wedit:redo_button';
    }
}
Tools.register(RedoTool, 'redo');
class SpawnGlassTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_spawn_glass';
        this.itemTool = 'wedit:spawn_glass';
        this.use = (player, session) => {
            if (Server.runCommand(`execute "${player.nameTag}" ~~~ setblock ~~~ glass`).error) {
                throw RawText.translate('worldedit.spawn-glass.error');
            }
        };
    }
}
Tools.register(SpawnGlassTool, 'spawn_glass');
class SelectionFillTool extends CommandButton {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_selection_fill';
        this.command = 'set';
        this.itemTool = 'wedit:selection_fill';
    }
}
Tools.register(SelectionFillTool, 'selection_fill');
class ConfigTool extends Tool {
    constructor() {
        super(...arguments);
        this.tag = 'wedit:performing_config';
        this.itemTool = 'wedit:config_button';
        this.use = (player, session) => {
            session.enterSettings();
        };
    }
}
Tools.register(ConfigTool, 'config');
