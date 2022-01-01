import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'size',
    description: 'commands.wedit:size.description',
    usage: [
        {
            name: 'tier',
            type: 'int',
            range: [1, 6] as [number, number]
        }, {
            name: 'size',
            type: 'int',
            range: [1, null] as [number, null]
        }
    ]
};

commandList['size'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    if (!session.hasTool(brush)) {
        throw RawText.translate('commands.wedit:brush.noBind');
    }
    
    session.setToolProperty(brush, 'size', args.get('size'));
    return RawText.translate('commands.generic.wedit:wandInfo');
}];