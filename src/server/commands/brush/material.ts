import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';
import { getBrushTier } from './brush.js';

const registerInformation = {
    name: 'material',
    permission: 'worldedit.brush.options.material',
    description: 'commands.wedit:material.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

commandList['material'] = [registerInformation, (session, builder, args) => {
    const brush = getBrushTier(builder);
    if (!session.hasTool(brush)) {
        throw RawText.translate('commands.wedit:brush.noBind');
    }
    
    session.setToolProperty(brush, 'material', args.get('pattern'));
    return RawText.translate('commands.generic.wedit:wandInfo');
}];