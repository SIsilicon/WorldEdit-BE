import { assertPositiveInt, assertValidInteger } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { SphereShape } from '../../shapes/sphere.js';
import { getPlayerBlockLocation } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'sphere',
    description: 'Generate a filled sphere.',
    usages: [
        '[-hr] <pattern: Pattern> <radii: int>',
        '[-hr] <pattern: Pattern> <radiiXZ: int>,<radiiY: int>',
        '[-hr] <pattern: Pattern> <radiiX: int>,<radiiY: int>,<radiiZ: int>'
    ]
};
commandList['sphere'] = [registerInformation, (session, builder, args) => {
        if (args.length < 2)
            throw 'This command expects at least two arguments!';
        let pattern;
        let radii;
        let isHollow = false;
        let isRaised = false;
        for (const arg of args) {
            if (arg.charAt(0) == '-') {
                for (const char of arg.slice(1)) {
                    if (char == 'h') {
                        isHollow = true;
                    }
                    else if (char == 'r') {
                        isRaised = true;
                    }
                }
            }
            else if (!pattern) {
                pattern = Pattern.parseArg(arg);
            }
            else if (!radii) {
                radii = [];
                const subArgs = arg.split(',');
                for (const n of subArgs) {
                    const radius = parseInt(n);
                    assertValidInteger(radius, n);
                    assertPositiveInt(radius);
                    radii.push(radius);
                }
                if (radii.length > 3)
                    throw 'Too many radii arguments are specified!';
                while (radii.length < 3) {
                    radii.push(radii[0]);
                }
            }
        }
        if (!pattern)
            throw 'Pattern not defined!';
        if (!radii)
            throw 'Radii not defined!';
        const loc = getPlayerBlockLocation(builder).offset(0, isRaised ? radii[1] : 0, 0);
        const sphereShape = new SphereShape(...radii);
        const count = sphereShape.generate(loc, pattern, null, session, { 'hollow': isHollow });
        return RawText.translate('worldedit.generate.created').with(`${count}`);
    }];
