import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'range',
    description: 'commands.wedit:range.description',
    usage: [
        {
            name: 'tier',
            type: 'int',
            range: [1, 6] as [number, number]
        }, {
            name: 'range',
            type: 'int',
            range: [1, null] as [number, null],
            default: -1
        }
    ]
};

commandList['range'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    
    session.setToolProperty(brush, 'range', args.get('range'));
    return RawText.translate('worldedit.wand.generic.info');
}];