import { BlockLocation } from 'mojang-minecraft';
import { assertPositiveNumber, assertValidNumber } from '@modules/assert.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@modules/rawtext.js';
import { PyramidShape } from '../../shapes/pyramid.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'pyramid',
    description: 'Generate a filled pyramid.',
    usage: [
        {
            flag: 'h'
        }, {
            name: 'pattern',
            type: 'Pattern'
        }, {
            name: 'size',
            type: 'int',
            range: [1, null] as [number, null]
        }
    ]
};

commandList['pyramid'] = [registerInformation, (session, builder, args) => {
    let pattern: Pattern = args.get('pattern');
    let isHollow = args.has('h');
    let size: number = args.get('size');

    const loc = PlayerUtil.getBlockLocation(builder);
    const pyramidShape = new PyramidShape(size);
    const count = pyramidShape.generate(loc, pattern, null, session, {'hollow': isHollow});

    return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
