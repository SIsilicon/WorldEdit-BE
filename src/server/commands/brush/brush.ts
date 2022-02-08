import { Player, EntityInventoryComponent } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
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
                    flag: 'h',
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
                    flag: 'h',
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
    ],
};

export function getBrushTier(player: Player) {
    const container = (player.getComponent('minecraft:inventory') as EntityInventoryComponent).container;
    const item = container.getItem(player.selectedSlot).id;
    
    if (item == 'wedit:wooden_brush' || item == 'minecraft:wooden_shovel') {
        return 'wooden_brush';
    } else if (item == 'wedit:stone_brush' || item == 'minecraft:stone_shovel') {
        return 'stone_brush';
    } else if (item == 'wedit:iron_brush' || item == 'minecraft:iron_shovel') {
        return 'iron_brush';
    } else if (item == 'wedit:golden_brush' || item == 'minecraft:golden_shovel') {
        return 'golden_brush';
    } else if (item == 'wedit:diamond_brush' || item == 'minecraft:diamond_shovel') {
        return 'diamond_brush';
    } else if (item == 'wedit:netherite_brush' || item == 'minecraft:netherite_shovel') {
        return 'netherite_brush';
    } else {
        throw 'commands.wedit:brush.invalidItem';
    }
}

const sphere_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[1].permission);
    session.setTool(brush, new SphereBrush(
        args.get('radius'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.generic.wedit:wandInfo');
};

const cylinder_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[2].permission);
    session.setTool(brush, new CylinderBrush(
        args.get('radius'),
        args.get('height'),
        args.get('pattern'),
        args.has('h')
    ));
    return RawText.translate('commands.generic.wedit:wandInfo');
};

const smooth_command = (session: PlayerSession, builder: Player, brush: string, args: Map<string, any>) => {
    assertPermission(builder, registerInformation.usage[3].permission);
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
    const brush = getBrushTier(builder);
    
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
