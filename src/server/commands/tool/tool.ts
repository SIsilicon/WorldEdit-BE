import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { Mask } from '@modules/mask.js';
import { PlayerUtil } from '@modules/player_util.js';
import { assertPermission } from '@modules/assert.js';
import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'tool',
    description: 'commands.wedit:tool.description',
    usage: [
        {
            subName: 'stacker',
            permission: 'worldedit.tool.stack',
            description: 'commands.wedit:tool.description.stacker',
            args: [
                {
                    name: 'range',
                    type: 'int',
                    range: [1, null] as [number, null],
                    default: 1
                }, {
                    name: 'mask',
                    type: 'Mask',
                    default: new Mask()
                }
            ]
        }
    ]
};

const stack_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[0].permission);
    session.setTool('stacker_wand', args.get('range'), args.get('mask'));
    
    if (!PlayerUtil.hasItem(builder, 'wedit:stacker_wand') && !PlayerUtil.hasItem(builder, 'minecraft:iron_axe')) {
        Server.runCommand(`give @s iron_axe`, builder);
    }
    return 'commands.generic.wedit:wandInfo';
};

commandList['tool'] = [registerInformation, (session, builder, args) => {
    if (args.has('stacker'))
        return stack_command(session, builder, args);
}];
