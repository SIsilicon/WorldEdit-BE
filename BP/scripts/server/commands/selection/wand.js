import { Server } from '../../../library/Minecraft.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerDimension } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'wand',
    description: 'Give yourself a selection wand.',
    usage: '',
};
commandList['wand'] = [registerInformation, (session, builder, args) => {
        const dimension = PlayerUtil.getDimension(builder)[1];
        Server.runCommand(`clear "${builder.nameTag}" wedit:selection_wand`, dimension);
        Server.runCommand(`give "${builder.nameTag}" wedit:selection_wand`, dimension);
        return RawText.translate('worldedit.wand.selwand.info');
    }];
