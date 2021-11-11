import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { RawText } from '../../modules/rawtext.js';
import { Pattern } from '../../modules/pattern.js'
import { Mask } from '../../modules/mask.js'
import { getPlayerDimension, printDebug } from '../../util.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';

import { SphereBrush } from '../../brushes/sphere_brush.js';
import { CylinderBrush } from '../../brushes/cylinder_brush.js';

const registerInformation = {
    cancelMessage: true,
    name: 'brush',
    description: 'Configure your brushes',
    aliases: ['br'],
    usages: [
        '<tier: 1..6> none',
        '<tier: 1..6> sphere [-h] <pattern: Pattern> [radius: int]',
        '<tier: 1..6> cyl [-h] <pattern: Pattern> [radius: int] [height: int]',
        '<tier: 1..6> mask [mask: Mask]',
        '<tier: 1..6> tracemask [mask: Mask]',
        '<tier: 1..6> size <size: int>',
        '<tier: 1..6> range <range: int>'
    ]
};

const sphere_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    let hollow = false;
    if (args[0] == '-h') {
        args.shift();
        hollow = true;
    }
    
    const pattern = Pattern.parseArg(args.shift() ?? '');
    let radius = parseInt(args.shift());
    radius = radius == radius ? radius : 3;
    
    session.setTool(brush, new SphereBrush(radius, pattern, hollow));
    return RawText.translate('worldedit.wand.generic.info');
};

const cylinder_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    let hollow = false;
    if (args[0] == '-h') {
        args.shift();
        hollow = true;
    }
    
    const pattern = Pattern.parseArg(args.shift() ?? '');
    let radius = parseInt(args.shift());
    radius = radius == radius ? radius : 3;
    let height = parseInt(args.shift());
    height = height == height ? height : 1;
    
    session.setTool(brush, new CylinderBrush(radius, height, pattern, hollow));
    return RawText.translate('worldedit.wand.generic.info');
};

const mask_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    const mask = Mask.parseArg(args.shift() ?? '');
    session.setToolProperty(brush, 'mask', mask);
    return RawText.translate('worldedit.wand.generic.info');
};

const tracemask_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    const mask = Mask.parseArg(args.shift() ?? '');
    session.setToolProperty(brush, 'traceMask', mask);
    return RawText.translate('worldedit.wand.generic.info');
};

const size_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    let sizeArg = args.shift();
    const size = parseInt(sizeArg);
    if (size != size) {
        throw RawText.translate('worldedit.error.invalid-integer').with(sizeArg ?? "' '");
    }
    session.setToolProperty(brush, 'size', size);
    return RawText.translate('worldedit.wand.generic.info');
};

const range_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    let rangeArg = args.shift();
    const range = parseInt(rangeArg);
    if (range != range) {
        throw RawText.translate('worldedit.error.invalid-integer').with(rangeArg ?? "' '");
    }
    session.setToolProperty(brush, 'range', range);
    return RawText.translate('worldedit.wand.generic.info');
};

const none_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
    if (session.hasTool(brush)) {
        session.unbindTool(brush);
    }
    return RawText.translate('worldedit.wand.generic.info');
};

commandList['brush'] = [registerInformation, (session, builder, args) => {
    const tier: number = parseInt(args[0]);
    if (tier != tier || tier < 1 || tier > 6) {
        throw RawText.translate('worldedit.brush.invalid-tier').with(args[0]);
    }
    
    if (!args[1]) {
        throw 'No subcommand has been specified. Type (;help brush) to see the available subcommands';
    }
    
    const brush = {
        1: 'wooden_brush',
        2: 'stone_brush',
        3: 'iron_brush',
        4: 'golden_brush',
        5: 'diamond_brush',
        6: 'netherite_brush'
    }[tier];
    
    const subArgs = args.slice(2);
    switch (args[1]) {
        case 'sphere':
            return sphere_command(session, builder, brush, subArgs);
        case 'cyl': case 'cylinder':
            return cylinder_command(session, builder, brush, subArgs);
        case 'mask':
            return mask_command(session, builder, brush, subArgs);
        case 'tracemask':
            return tracemask_command(session, builder, brush, subArgs);
        case 'size':
            return size_command(session, builder, brush, subArgs);
        case 'none':
            return none_command(session, builder, brush, subArgs);
        default:
            throw RawText.translate('commands.generic.unknown').with('brush <tier> ' + args[1]);
    }
}];
