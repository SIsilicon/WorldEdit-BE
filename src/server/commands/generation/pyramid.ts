import { BlockLocation } from 'mojang-minecraft';
import { assertPositiveInt, assertValidInteger } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { PyramidShape } from '../../shapes/pyramid.js';
import { getPlayerBlockLocation } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'pyramid',
    description: 'Generate a filled pyramid.',
    usage: '[-h] <pattern: Patterm> <size: int>',
};

commandList['pyramid'] = [registerInformation, (session, builder, args) => {
    if (args.length < 2) throw 'This command expects at least two arguments!';
    
    let pattern: Pattern;
    let size: number;
    let isHollow = false;
    for (const arg of args) {
        if (arg == '-h') {
            isHollow = true;
        } else if (!pattern) {
            pattern = Pattern.parseArg(arg);
        } else if (!size) {
            size = parseInt(arg);
            assertValidInteger(size, arg);
            assertPositiveInt(size);
        }
    }
    
    if (!pattern) throw 'Pattern not defined!';
    if (!size) throw 'Size not defined!';

    const loc = PlayerUtil.getBlockLocation(builder);
    const pyramidShape = new PyramidShape(size);
    const count = pyramidShape.generate(loc, pattern, null, session, {'hollow': isHollow});

    return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
