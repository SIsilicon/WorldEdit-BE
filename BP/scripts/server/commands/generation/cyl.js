import { assertPositiveInt, assertValidInteger } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { CylinderShape } from '../../shapes/cylinder.js';
import { getPlayerBlockLocation } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'cyl',
    description: 'Generate a filled cylinder.',
    usages: [
        '[-hr] <pattern: Pattern> <radii: int> [height: int]',
        '[-hr] <pattern: Pattern> <radiiX: int>,<radiiZ: int> [height: int]',
    ]
};
commandList['cyl'] = [registerInformation, (session, builder, args) => {
        if (args.length < 2)
            throw 'This command expects at least two arguments!';
        let pattern;
        let radii;
        let height;
        let isHollow = false;
        let isRaised = false;
        for (const arg of args) {
            if (arg == '-h') {
                isHollow = true;
            }
            else if (arg == '-r') {
                isRaised = true;
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
                if (radii.length > 2)
                    throw 'Too many radii arguments are specified!';
                while (radii.length < 2) {
                    radii.push(radii[0]);
                }
            }
            else if (!height) {
                height = parseInt(arg);
                assertValidInteger(height, arg);
                assertPositiveInt(height);
            }
        }
        if (!pattern)
            throw 'Pattern not defined!';
        if (!radii)
            throw 'Radii not defined!';
        height = height || 1;
        const loc = PlayerUtil.getBlockLocation(builder).offset(0, isRaised ? height / 2 : 0, 0);
        const cylShape = new CylinderShape(height, ...radii);
        const count = cylShape.generate(loc, pattern, null, session, { 'hollow': isHollow });
        return RawText.translate('worldedit.generate.created').with(`${count}`);
    }];
