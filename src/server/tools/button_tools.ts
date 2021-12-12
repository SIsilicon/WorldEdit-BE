import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js'
import { PlayerSession } from '../sessions.js';
import { printDebug } from '../util.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@modules/rawtext.js';

abstract class CommandButton extends Tool {
    abstract readonly command: string;
    abstract readonly tag: string;
    abstract readonly itemTool: string;
    
    use = (player: Player, session: PlayerSession) => {
        session.usingItem = true;
        callCommand(player, this.command);
        session.usingItem = false;
    }
}

class CutTool extends CommandButton {
    tag = 'wedit:performing_cut';
    command = 'cut';
    itemTool = 'wedit:cut_button';
}
Tools.register(CutTool, 'cut');

class CopyTool extends CommandButton {
    tag = 'wedit:performing_copy';
    command = 'copy';
    itemTool = 'wedit:copy_button';
}
Tools.register(CopyTool, 'copy');

class PasteTool extends CommandButton {
    tag = 'wedit:performing_paste';
    command = 'paste';
    itemTool = 'wedit:paste_button';
}
Tools.register(PasteTool, 'paste');

class UndoTool extends CommandButton {
    tag = 'wedit:performing_undo';
    command = 'undo';
    itemTool = 'wedit:undo_button';
}
Tools.register(UndoTool, 'undo');

class RedoTool extends CommandButton {
    tag = 'wedit:performing_redo';
    command = 'redo';
    itemTool = 'wedit:redo_button';
}
Tools.register(RedoTool, 'redo');

class SpawnGlassTool extends Tool {
    tag = 'wedit:performing_spawn_glass';
    itemTool = 'wedit:spawn_glass';
    use = (player: Player, session: PlayerSession) => {
        if (Server.runCommand(`execute "${player.nameTag}" ~~~ setblock ~~~ glass`).error) {
                throw RawText.translate('worldedit.spawn-glass.error');
        }
    }
}
Tools.register(SpawnGlassTool, 'spawn_glass');

class SelectionFillTool extends Tool {
    tag = 'wedit:performing_selection_fill';
    itemTool = 'wedit:selection_fill';
    use = (player: Player, session: PlayerSession) => {
        session.usingItem = true;
        callCommand(player, 'set', ['placeholder']);
        session.usingItem = false;
    }
}
Tools.register(SelectionFillTool, 'selection_fill');

class ConfigTool extends Tool {
    tag = 'wedit:performing_config';
    itemTool = 'wedit:config_button';
    use = (player: Player, session: PlayerSession) => {
        session.enterSettings();
    }
}
Tools.register(ConfigTool, 'config');