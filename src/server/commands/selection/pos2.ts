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
    const prevPoints = session.getSelectionPoints();
    session.setSelectionPoint(1, loc);
    
    if (session.getSelectionPoints().some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        let translate: string;
        if (session.getSelectedBlockCount() == 0) {
            translate = `worldedit.selection.${session.selectionMode}.secondary`;
        } else {
            translate = `worldedit.selection.${session.selectionMode}.secondaryArea`;
        }
        return RawText.translate(translate)
            .with(printLocation(session.getSelectionPoints()[1]))
            .with(`${session.getSelectedBlockCount()}`);    
    }
    return '';
}

registerCommand(registerInformation, function (session, builder, args) {
    return setPos2(session, args.get('coordinates').relativeTo(builder, true));
});
