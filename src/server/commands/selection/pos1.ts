import { BlockLocation } from 'mojang-minecraft';
import { printLocation } from '../../util.js';
import { CommandPosition } from '@library/build/classes/commandBuilder.js';
import { commandList } from '../command_list.js';
import { PlayerSession } from '../../sessions.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'pos1',
    permission: 'worldedit.selection.pos',
    description: 'commands.wedit:pos1.description',
    usage: [
        {
            name: 'coordinates',
            type: 'xyz',
            default: new CommandPosition()
        }
    ],
    aliases: ['1']
};

export function setPos1(session: PlayerSession, loc: BlockLocation) {
    const prevPoints = session.getSelectionPoints();
    session.setSelectionPoint(0, loc);

    if (session.getSelectionPoints().some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        let translate: string;
        if (session.getSelectedBlockCount() == 0) {
            translate = `worldedit.selection.${session.selectionMode}.primary`;
        } else {
            translate = `worldedit.selection.${session.selectionMode}.primaryArea`;
        }
        return RawText.translate(translate)
            .with(printLocation(session.getSelectionPoints()[0]))
            .with(`${session.getSelectedBlockCount()}`);
    }
    return '';
}

commandList['pos1'] = [registerInformation, function (session, builder, args) {
    return setPos1(session, args.get('coordinates').relativeTo(builder, true));
}];
