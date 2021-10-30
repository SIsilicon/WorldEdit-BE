import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js'
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

import { RawText } from '../modules/rawtext.js';

abstract class CommandButton extends Tool {
    abstract readonly command: string;
    abstract readonly tag: string;
    
    useOn = Tool.emptyUseOn;
    use = (player: Player, session: PlayerSession) => {
        callCommand(player, this.command, []);
    }
}

class CutTool extends CommandButton {
    tag = 'wedit:performing_cut';
    command = 'cut';
}
Tools.register(CutTool, 'cut');

class CopyTool extends CommandButton {
    tag = 'wedit:performing_copy';
    command = 'copy';
}
Tools.register(CopyTool, 'copy');

class PasteTool extends CommandButton {
    tag = 'wedit:performing_paste';
    command = 'paste';
}
Tools.register(PasteTool, 'paste');

class UndoTool extends CommandButton {
    tag = 'wedit:performing_undo';
    command = 'undo';
}
Tools.register(UndoTool, 'undo');

class RedoTool extends CommandButton {
    tag = 'wedit:performing_redo';
    command = 'redo';
}
Tools.register(RedoTool, 'redo');

class SpawnGlassTool extends Tool {
    tag = 'wedit:performing_spawn_glass';
    useOn = Tool.emptyUseOn;
    use = (player: Player, session: PlayerSession) => {
        if (Server.runCommand(`execute "${player.nameTag}" ~~~ setblock ~~~ glass`).error) {
            throw RawText.translate('worldedit.spawn-glass.error');
        }
    }
}
Tools.register(SpawnGlassTool, 'spawn_glass');

class SelectionFillTool extends Tool {
    tag = 'wedit:performing_selection_fill';
    useOn = Tool.emptyUseOn;
    use = (player: Player, session: PlayerSession) => {
        session.usePickerPattern = true;
        callCommand(player, 'set', []);
        session.usePickerPattern = false;
    }
}
Tools.register(SelectionFillTool, 'selection_fill');