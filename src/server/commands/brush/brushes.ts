import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { RawText } from '../../modules/rawtext.js';
import { Pattern } from '../../modules/pattern.js'
import { PlayerUtil } from '../../modules/player_util.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';

import { SphereBrush } from '../../brushes/sphere_brush.js';
import { CylinderBrush } from '../../brushes/cylinder_brush.js';

const registerInformation = {
	cancelMessage: true,
	name: 'brush',
	description: 'Set the type of a brush',
	aliases: ['br'],
	usages: [
		'<tier: 1..6> none',
		'<tier: 1..6> sphere [-h] <pattern: Pattern> [radius: int]',
		'<tier: 1..6> cyl [-h] <pattern: Pattern> [radius: int] [height: int]'
	]
};

export function getBrushTier(args: string[]) {
    const tier: number = parseInt(args[0]);
	if (tier != tier || tier < 1 || tier > 6) {
		throw RawText.translate('worldedit.brush.invalid-tier').with(args[0]);
	}
	args.shift();
	
	return {
		1: 'wooden_brush',
		2: 'stone_brush',
		3: 'iron_brush',
		4: 'golden_brush',
		5: 'diamond_brush',
		6: 'netherite_brush'
	}[tier];
}

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

const none_command = (session: PlayerSession, builder: Player, brush: string, args: string[]) => {
	if (session.hasTool(brush)) {
		session.unbindTool(brush);
	}
	return RawText.translate('worldedit.wand.generic.info');
};

commandList['brush'] = [registerInformation, (session, builder, args) => {
	const brush = getBrushTier(args);
	
	if (!args[0]) {
		throw 'No subcommand has been specified. Type (;help brush) to see the available subcommands';
	}
	
	const subArgs = args.slice(1);
	switch (args[0]) {
		case 'sphere':
			return sphere_command(session, builder, brush, subArgs);
		case 'cyl': case 'cylinder':
			return cylinder_command(session, builder, brush, subArgs);
		case 'none':
			return none_command(session, builder, brush, subArgs);
		default:
			throw RawText.translate('commands.generic.unknown').with('brush <tier> ' + args[1]);
	}
}];
