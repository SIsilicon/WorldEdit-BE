import { Player } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { SphereBrush } from '../../brushes/sphere_brush.js';
import { CylinderBrush } from '../../brushes/cylinder_brush.js';
import { SmoothBrush } from '../../brushes/smooth_brush.js';
import { assertPermission } from '@modules/assert.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@notbeer-api';
import { registerCommand } from '../register_commands.js';

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
                    default: 2
                },
                {
                    name: 'iterations',
                    type: 'int',
                    default: 4
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

export function createDefaultBrush() {
    return new SphereBrush(1, new Pattern('cobblestone'), false);
}

const sphere_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[1].permission);
    session.bindTool('brush', null, new SphereBrush(
        args.get('radius'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.wedit:brush.bind.sphere').with(args.get('radius'));
};

const cylinder_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[2].permission);
    session.bindTool('brush', null, new CylinderBrush(
        args.get('radius'),
        args.get('height'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.wedit:brush.bind.cylinder').with(args.get('radius')).with(args.get('height'));
};

const smooth_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[3].permission);
    session.bindTool('brush', null, new SmoothBrush(
        args.get('radius'),
        args.get('iterations'),
        args.get('mask')
    ));
    
    let msg = 'commands.wedit:brush.bind.smooth.' + ((args.get('mask') as Mask).empty() ? 'noFilter' : 'filter');
    return RawText.translate(msg).with(args.get('radius')).with(args.get('iterations'));
};

registerCommand(registerInformation, function (session, builder, args) {
    let msg: RawText;
    if (args.has('sphere')) {
        msg = sphere_command(session, builder, args);
    } else if (args.has('cyl')) {
        msg = cylinder_command(session, builder, args);
     } else if (args.has('smooth')) {
        msg = smooth_command(session, builder, args);
    } else {
        session.unbindTool(null);
        return 'commands.wedit:brush.unbind';
    }
    return msg.append('text', '\n').append('translate', 'commands.generic.wedit:unbindInfo').with(';brush none');
});
