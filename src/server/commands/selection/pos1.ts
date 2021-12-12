import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { CommandPosition } from '@library/build/classes/commandBuilder.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'pos1',
    description: 'Set the first position of your selection to the specified or current position',
    usage: [
        {
            name: 'coordinates',
            type: 'xyz',
            default: new CommandPosition()
        }
    ]
};

commandList['pos1'] = [registerInformation, (session, builder, args) => {
    session.setSelectionPoint(0, args.get('coordinates').relativeTo(builder, true));

    let translate: string;
    if (session.getBlocksSelected().length == 0) {
        translate = 'worldedit.selection.cuboid.explain.primary';
    } else {
        translate = 'worldedit.selection.cuboid.explain.primary-area';
    }
    return RawText.translate(translate)
        .with(printLocation(session.getSelectionPoints()[0]))
        .with(`${session.getBlocksSelected().length}`);
}];
