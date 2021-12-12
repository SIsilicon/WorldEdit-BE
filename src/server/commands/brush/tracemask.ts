import { Mask } from '@modules/mask.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brushes.js';

const registerInformation = {
    name: 'tracemask',
    description: 'Set what blocks a brush can pass through',
    usage: [
        {
            name: 'tier',
            type: 'int',
            range: [1, 6] as [number, number],
        }, {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['tracemask'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(args);
    if (!session.hasTool(brush)) {
        throw RawText.translate('worldedit.wand.brush.no-bind');
    }
    
    const mask: Mask = args.get('mask');
    session.setToolProperty(brush, 'traceMask', mask.toString() ? mask : null);
    return RawText.translate('worldedit.wand.generic.info');
}];