import { Player, EntityInventoryComponent } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { assertPermission } from '@modules/assert.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';

import { SphereBrush } from '../../brushes/sphere_brush.js';
import { CylinderBrush } from '../../brushes/cylinder_brush.js';
import { SmoothBrush } from '../../brushes/smooth_brush.js';

const registerInformation = {
    name: 'brush',
    description: 'commands.wedit:brush.description',
    aliases: ['br'],
    usage: [
        {
            subName: 'none'
        },
        {
            subName: 'sphere',
            permission: 'worldedit.brush.sphere',
            description: 'commands.wedit:brush.description.sphere',
            args: [
                {
                    flag: 'h'
                },
                {
                    name: 'pattern',
                    type: 'Pattern'
                },
                {
                    name: 'radius',
                    type: 'float',
                    default: 3
                }
            ]
        },
        {
            subName: 'cyl',
            permission: 'worldedit.brush.cylinder',
            description: 'commands.wedit:brush.description.cylinder',
            args: [
                {
                    flag: 'h'
                },
                {
                    name: 'pattern',
                    type: 'Pattern'
                },
                {
                    name: 'radius',
                    type: 'float',
                    default: 3
                },
                {
                    name: 'height',
                    type: 'int',
                    default: 3
                }
            ]
        },
        {
            subName: 'smooth',
            permission: 'worldedit.brush.smooth',
            description: 'commands.wedit:brush.description.smooth',
            args: [
                {
                    name: 'radius',
                    type: 'float',
                    default: 3
                },
                {
                    name: 'iterations',
                    type: 'int',
                    default: 1
                },
                {
                    name: 'mask',
                    type: 'Mask',
                    default: new Mask()
                }
            ]
        }
    ]
};

const sphere_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[1].permission);
    session.bindTool('brush', new SphereBrush(
        args.get('radius'),
        args.get('pattern'),
        args.has('h')
    ));
};

const cylinder_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[2].permission);
    session.bindTool('brush', new CylinderBrush(
        args.get('radius'),
        args.get('height'),
        args.get('pattern'),
        args.has('h')
    ));
};

const smooth_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[3].permission);
    session.bindTool('brush', new SmoothBrush(
        args.get('radius'),
        args.get('iterations'),
        args.get('mask')
    ));
};

commandList['brush'] = [registerInformation, (session, builder, args) => {
    if (args.has('sphere')) {
        sphere_command(session, builder, args);
    } else if (args.has('cyl')) {
        cylinder_command(session, builder, args);
     } else if (args.has('smooth')) {
        smooth_command(session, builder, args);
    } else {
        session.unbindTool();
    }
    return 'commands.generic.wedit:wandInfo';
}];
