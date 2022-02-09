import { Mask } from '@modules/mask.js';
import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'mask',
    permission: 'worldedit.brush.options.mask',
    description: 'commands.wedit:mask.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

commandList['mask'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(builder);
    if (!session.hasTool(brush)) {
        throw RawText.translate('commands.wedit:brush.noBind');
    }
    
    session.setToolProperty(brush, 'mask', args.get('mask'));
    return RawText.translate('commands.generic.wedit:wandInfo');
}];