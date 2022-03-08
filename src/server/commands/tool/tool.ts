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
            subName: 'none'
        },
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
        },
        {
            subName: 'selwand',
            permission: 'worldedit.setwand',
            description: 'commands.wedit:tool.description.selwand'
        },
        {
            subName: 'navwand',
            permission: 'worldedit.setwand',
            description: 'commands.wedit:tool.description.navwand'
        }
    ]
};

const stack_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[0].permission);
    session.bindTool('stacker_wand', args.get('range'), args.get('mask'));
};

const selwand_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[0].permission);
    session.bindTool('selection_wand');
};

const navwand_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[0].permission);
    session.bindTool('navigation_wand');
};

commandList['tool'] = [registerInformation, (session, builder, args) => {
    if (args.has('stacker')) {
        stack_command(session, builder, args);
    } else if (args.has('selwand')) {
        selwand_command(session, builder, args);
    } else if (args.has('navwand')) {
        navwand_command(session, builder, args);
    } else {
        session.unbindTool();
    }
    return 'commands.generic.wedit:wandInfo';
}];
