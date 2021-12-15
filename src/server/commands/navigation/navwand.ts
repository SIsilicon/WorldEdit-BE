import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'navwand',
    description: 'commands.wedit:navwand.description',
};

commandList['navwand'] = [registerInformation, (session, builder, args) => {
    const dimension = PlayerUtil.getDimension(builder)[1];
    Server.runCommand(`clear "${builder.name}" wedit:navigation_wand`, dimension);
    Server.runCommand(`give "${builder.name}" wedit:navigation_wand`, dimension);
    return RawText.translate('worldedit.wand.navwand.info');
}];
