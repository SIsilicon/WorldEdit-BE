import { BlockLocation } from 'mojang-minecraft';
import { assertPositiveNumber, assertValidNumber } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { CylinderShape } from '../../shapes/cylinder.js';
import { PlayerUtil } from '../../modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
	cancelMessage: true,
	name: 'cyl',
	description: 'Generate a filled cylinder.',
	usages: [
		'[-hr] <pattern: Pattern> <radii: float> [height: int]',
		'[-hr] <pattern: Pattern> <radiiX: float>,<radiiZ: float> [height: int]',
	]
};

commandList['cyl'] = [registerInformation, (session, builder, args) => {
	if (args.length < 2) throw 'This command expects at least two arguments!';
	
	let pattern: Pattern;
	let radii: number[];
	let height: number;
	let isHollow = false;
	let isRaised = false;
	
	for (const arg of args) {
		if (arg.charAt(0) == '-') {
			for (const char of arg.slice(1)) {
				if (char == 'h') {
					isHollow = true;
				} else if (char == 'r') {
					isRaised = true;
				}
			}
		} else if (!pattern) {
			pattern = Pattern.parseArg(arg);
		} else if (!radii) {
			radii = [];
			const subArgs = arg.split(',');
			for (const n of subArgs) {
				const radius = parseFloat(n);
				assertValidNumber(radius, n);
				assertPositiveNumber(radius);
				radii.push(radius);
			}
			if (radii.length > 2) throw 'Too many radii arguments are specified!';
			while (radii.length < 2) {
				radii.push(radii[0]);
			}
		}
		else if (!height) {
			height = parseInt(arg);
			assertValidNumber(height, arg);
			assertPositiveNumber(height);
		}
	}
	
	if (!pattern) throw 'Pattern not defined!';
	if (!radii) throw 'Radii not defined!';
	height = height || 1;

	const loc = PlayerUtil.getBlockLocation(builder).offset(0, isRaised ? height/2 : 0, 0);
	
	const cylShape = new CylinderShape(height, ...<[number, number]>radii);
	const count = cylShape.generate(loc, pattern, null, session, {'hollow': isHollow});

	return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
