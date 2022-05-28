import { BlockLocation } from 'mojang-minecraft';
import { printLocation } from '../../util.js';
import { registerCommand } from '../register_commands.js';
import { PlayerSession } from '../../sessions.js';
import { RawText, CommandPosition } from '@notbeer-api';

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
    const prevPoints = session.selection.points;
    session.selection.set(0, loc);

    if (session.selection.points.some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        let translate: string;
        const blockCount = session.selection.getBlockCount();
        if (!blockCount) {
            translate = `worldedit.selection.${session.selection.mode}.primary`;
        } else {
            translate = `worldedit.selection.${session.selection.mode}.primaryArea`;
        }
        return RawText.translate(translate)
            .with(printLocation(session.selection.points[0]))
            .with(`${blockCount}`);
    }
    return '';
}

registerCommand(registerInformation, function (session, builder, args) {
    return setPos1(session, args.get('coordinates').relativeTo(builder, true));
});
