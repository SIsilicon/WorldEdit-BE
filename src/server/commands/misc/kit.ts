import { Server } from '@library/Minecraft.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'kit',
    permission: 'worldedit.kit',
    description: 'commands.wedit:kit.description'
};

commandList['kit'] = [registerInformation, (session, builder, args) => {
    const items = [
        'wedit:_tool_wooden_axe',
        'wedit:selection_fill',
        'wedit:pattern_picker',
        'wedit:copy_button',
        'wedit:cut_button',
        'wedit:paste_button',
        'wedit:undo_button',
        'wedit:redo_button',
        'wedit:spawn_glass',
        
        'wedit:flip_button',
        'wedit:rotate_cw_button',
        'wedit:rotate_ccw_button',
        'wedit:mask_picker',
        'wedit:draw_line',
        'wedit:selection_wall',
        'wedit:selection_outline',
        'wedit:config_button'
    ];
    
    for (const item of items) {
        if (Server.runCommand(`clear @s ${item} -1 0`, builder).error) {
            Server.runCommand(`give @s ${item}`, builder);
        }
    }
    
    return RawText.translate('commands.wedit:kit.explain');
}];