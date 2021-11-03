import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { Mask } from '../../modules/mask.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerDimension, printDebug } from '../../util.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';

const registerInformation = {
    cancelMessage: true,
    name: 'tool',
    description: 'Get all sorts of tools (stacker)',
    usages: [
        'stacker [range: int] [mask: Mask]'
    ]
};

const stack_command = (session: PlayerSession, builder: Player, args: string[]) => {
    let range = parseInt(args[0]);
    range = range == range ? range : 5;
    let mask = Mask.parseArg(args[1] ?? '');
    session.setTool('stacker_wand', range, mask);
    
    const dimension = getPlayerDimension(builder)[1];
    Server.runCommand(`clear "${builder.nameTag}" wedit:stacker_wand`, dimension);
    Server.runCommand(`give "${builder.nameTag}" wedit:stacker_wand`, dimension);
    return RawText.translate('worldedit.wand.generic.info');
};

commandList['tool'] = [registerInformation, (session, builder, args) => {
    if (!args[0]) return 'The following subcommands are available: stacker';
    
    const subArgs = args.slice(1);
    switch (args[0]) {
        case 'stacker':
            return stack_command(session, builder, subArgs);
        default:
            throw RawText.translate('commands.generic.unknown').with(session + ' ' + args[0]);
    }
}];
