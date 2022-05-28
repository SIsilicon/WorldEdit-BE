import { printLocation } from '../../util.js';
import { registerCommand } from '../register_commands.js';
import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { RawText, CommandPosition } from '@notbeer-api';

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

export function setPos2(session: PlayerSession, loc: BlockLocation) {
    const prevPoints = session.selection.points;
    session.selection.set(1, loc);
    
    if (session.selection.points.some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        let translate: string;
        const blockCount = session.selection.getBlockCount();
        if (!blockCount) {
            translate = `worldedit.selection.${session.selection.mode}.secondary`;
        } else {
            translate = `worldedit.selection.${session.selection.mode}.secondaryArea`;
        }
        return RawText.translate(translate)
            .with(printLocation(session.selection.points[1]))
            .with(`${blockCount}`);    
    }
    return '';
}

registerCommand(registerInformation, function (session, builder, args) {
    return setPos2(session, args.get('coordinates').relativeTo(builder, true));
});
