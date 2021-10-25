import { Server } from '../../../library/Minecraft.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerDimension } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'navwand',
    description: 'Gives you a navigation wand.',
    usage: 'navwand',
};
commandList['navwand'] = [registerInformation, (session, builder, args) => {
        const dimension = getPlayerDimension(builder)[1];
        Server.runCommand(`clear ${builder.nameTag} wedit:selection_wand`, dimension);
        Server.runCommand(`give ${builder.nameTag} wedit:selection_wand`, dimension);
        return RawText.translate('worldedit.wand.navwand.info');
    }];
