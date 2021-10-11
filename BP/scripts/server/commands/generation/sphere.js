import { assertPositiveInt, assertValidInteger } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerBlockLocation, getPlayerDimension } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'sphere',
    description: 'Generate a filled sphere.',
    usage: '[-hr] <pattern> <radii>',
};
commandList['sphere'] = [registerInformation, (session, builder, args) => {
        if (args.length < 2)
            throw 'This command expects at least two arguments!';
        let pattern;
        let radii;
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
        const min = loc.offset(-radii[0], -radii[1], -radii[2]);
        const max = loc.offset(radii[0], radii[1], radii[2]);
        const blocksAffected = [];
        const radiiOff = radii.map(v => v + 0.5);
        for (const block of min.blocksBetween(max)) {
            if (isHollow) {
                let hLocal = [
                    (block.x - loc.x) / (radiiOff[0] - 1.0),
                    (block.y - loc.y) / (radiiOff[1] - 1.0),
                    (block.z - loc.z) / (radiiOff[2] - 1.0)
                ];
                if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] + hLocal[2] * hLocal[2] < 1.0) {
                    continue;
                }
            }
            let local = [
                (block.x - loc.x) / radiiOff[0],
                (block.y - loc.y) / radiiOff[1],
                (block.z - loc.z) / radiiOff[2]
            ];
            if (local[0] * local[0] + local[1] * local[1] + local[2] * local[2] < 1.0) {
                blocksAffected.push(block);
            }
        }
        const history = session.getHistory();
        history.record();
        history.addUndoStructure(min, max, blocksAffected);
        let count = 0;
        const dimension = getPlayerDimension(builder)[1];
        for (const block of blocksAffected) {
            if (!pattern.setBlock(block, dimension)) {
                count++;
            }
        }
        history.addRedoStructure(min, max, blocksAffected);
        history.commit();
        return RawText.translate('worldedit.generate.created').with(`${count}`);
    }];
