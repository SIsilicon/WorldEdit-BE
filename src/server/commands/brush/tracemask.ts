import { Mask } from '@modules/mask.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'tracemask',
    permission: 'worldedit.brush.options.tracemask',
    description: 'commands.wedit:tracemask.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['tracemask'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(builder);
    if (!session.hasTool(brush)) {
        throw RawText.translate('commands.wedit:brush.noBind');
    }
    
    const mask: Mask = args.get('mask');
    session.setToolProperty(brush, 'traceMask', mask.toString() ? mask : null);
    return RawText.translate('commands.generic.wedit:wandInfo');
}];