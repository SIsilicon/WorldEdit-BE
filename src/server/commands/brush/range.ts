import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'range',
    permission: 'worldedit.brush.options.range',
    description: 'commands.wedit:range.description',
    usage: [
        {
            name: 'range',
            type: 'int',
            range: [1, null] as [number, null],
            default: -1
        }
    ]
};

commandList['range'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(builder);
    if (!session.hasTool(brush)) {
        throw RawText.translate('commands.wedit:brush.noBind');
    }
    
    session.setToolProperty(brush, 'range', args.get('range'));
    return RawText.translate('commands.generic.wedit:wandInfo');
}];