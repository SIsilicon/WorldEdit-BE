import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';

import { SphereBrush } from '../../brushes/sphere_brush.js';
import { CylinderBrush } from '../../brushes/cylinder_brush.js';
import { SmoothBrush } from '../../brushes/smooth_brush.js';

const registerInformation = {
    name: 'brush',
    description: 'commands.wedit:brush.description',
    aliases: ['br'],
    usage: [
        {
            name: 'tier',
            type: 'int',
            range: [1, 6] as [number, number],
        }, {
            subName: 'none',
            args: []
        }, {
            subName: 'sphere',
            args: [
                {
                    flag: 'h',
                }, {
                    name: 'pattern',
                    type: 'Pattern'
                }, {
                    name: 'radius',
                    type: 'float',
                    default: 3
                }
            ]
        }, {
            subName: 'cyl',
            args: [
                {
                    flag: 'h',
                }, {
                    name: 'pattern',
                    type: 'Pattern'
                }, {
                    name: 'radius',
                    type: 'float',
                    default: 3
                }, {
                    name: 'height',
                    type: 'int',
                    default: 3
                }
            ]
        }, {
            subName: 'smooth',
            args: [
                {
                    name: 'radius',
                    type: 'float',
                    default: 3
                }, {
                    name: 'iterations',
                    type: 'int',
                    default: 1
                }, {
                    name: 'mask',
                    type: 'Mask',
                    default: new Mask()
                }
            ]
        }
    ],
};

export function getBrushTier(args: Map<string, any>) {
    return {
        1: 'wooden_brush',
        2: 'stone_brush',
        3: 'iron_brush',
        4: 'golden_brush',
        5: 'diamond_brush',
        6: 'netherite_brush'
    }[<number> args.get('tier')];
}

const sphere_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    session.setTool(brush, new SphereBrush(
        args.get('radius'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.generic.wedit:wandInfo');
};

const cylinder_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    session.setTool(brush, new CylinderBrush(
        args.get('radius'),
        args.get('height'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.generic.wedit:wandInfo');
};

const smooth_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    session.setTool(brush, new SmoothBrush(
        args.get('radius'),
        args.get('iterations'),
        args.get('mask')
    ));
    return RawText.translate('commands.generic.wedit:wandInfo');
};

const none_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    if (session.hasTool(brush)) {
        session.unbindTool(brush);
    }
    return RawText.translate('commands.generic.wedit:wandInfo');
};

commandList['brush'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    
    if (args.has('sphere')) {
        return sphere_command(session, builder, brush, args);
    } else if (args.has('cyl')) {
        return cylinder_command(session, builder, brush, args);
     } else if (args.has('smooth')) {
        return smooth_command(session, builder, brush, args);
    } else {
        return none_command(session, builder, brush, args);
    }
    // throw RawText.translate('commands.generic.unknown').with('brush <tier> ' + args[1]);
}];
