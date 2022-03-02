import { printLocation, regionVolume } from '../../util.js';
import { CommandPosition } from '@library/build/classes/commandBuilder.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'pos2',
    permission: 'worldedit.selection.pos',
    description: 'commands.wedit:pos2.description',
    usage: [
        {
            name: 'coordinates',
            type: 'xyz',
            default: new CommandPosition()
        }
    ],
    aliases: ['2']
};

commandList['pos2'] = [registerInformation, (session, builder, args) => {
    session.setSelectionPoint(1, args.get('coordinates').relativeTo(builder, true));

    let translate: string;
    if (session.getSelectedBlockCount() == 0) {
        translate = 'worldedit.selection.cuboid.secondary';
    } else {
        translate = 'worldedit.selection.cuboid.secondaryArea';
    }
    return RawText.translate(translate)
        .with(printLocation(session.getSelectionPoints()[1]))
        .with(`${session.getSelectedBlockCount()}`);
}];
