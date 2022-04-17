import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@modules/rawtext.js';
import { PyramidShape } from '../../shapes/pyramid.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'pyramid',
    permission: 'worldedit.generation.pyramid',
    description: 'commands.wedit:pyramid.description',
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

commandList['pyramid'] = [registerInformation, function* (session, builder, args) {
    let pattern: Pattern = args.get('pattern');
    let isHollow = args.has('h');
    let size: number = args.get('size');

    const loc = PlayerUtil.getBlockLocation(builder);
    const pyramidShape = new PyramidShape(size);
    const count = yield* pyramidShape.generate(loc, pattern, null, session, {'hollow': isHollow});

    return RawText.translate('commands.blocks.wedit:created').with(`${count}`);
}];
