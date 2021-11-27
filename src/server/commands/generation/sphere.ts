import { BlockLocation } from 'mojang-minecraft';
import { assertPositiveNumber, assertValidNumber } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { PlayerUtil } from '../../modules/player_util.js';
import { SphereShape } from '../../shapes/sphere.js';
import { printDebug, vector } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
	cancelMessage: true,
	name: 'sphere',
	description: 'Generate a filled sphere.',
	usages: [
		'[-hr] <pattern: Pattern> <radii: float>',
		'[-hr] <pattern: Pattern> <radiiXZ: float>,<radiiY: float>',
		'[-hr] <pattern: Pattern> <radiiX: float>,<radiiY: float>,<radiiZ: float>'
	]
};

commandList['sphere'] = [registerInformation, (session, builder, args) => {
	if (args.length < 2) throw 'This command expects at least two arguments!';
	
	let pattern: Pattern;
	let radii: number[];
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
			if (radii.length > 3) throw 'Too many radii arguments are specified!';
			while (radii.length < 3) {
				radii.push(radii[0]);
			}
		}
	}
	
	if (!pattern) throw 'Pattern not defined!';
	if (!radii) throw 'Radii not defined!';

	const loc = PlayerUtil.getBlockLocation(builder).offset(0, isRaised ? radii[1] : 0, 0);
	
	const sphereShape = new SphereShape(...<vector>radii);
	const count = sphereShape.generate(loc, pattern, null, session, {'hollow': isHollow});
	
	return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
