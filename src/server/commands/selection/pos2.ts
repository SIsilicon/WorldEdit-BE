import { getPlayerBlockLocation, printLocation, regionVolume } from '../../util.js';

import { parsePosition } from './selection_helper.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';

const registerInformation = {
    cancelMessage: true,
    name: 'pos2',
    description: 'Set the second position of your selection as your current position',
    usage: '[coordinates: xyx]',
};

commandList['pos2'] = [registerInformation, (session, builder, args) => {
    let loc = getPlayerBlockLocation(builder);
    if (args.length > 0) {
        loc = parsePosition(args, loc);
    }
    session.setSelectionPoint(1, loc);

    let translate: string;
    if (session.getBlocksSelected().length == 0) {
        translate = 'worldedit.selection.cuboid.explain.secondary';
    } else {
        translate = 'worldedit.selection.cuboid.explain.secondary-area';
    }
    return RawText.translate(translate)
        .with(printLocation(session.getSelectionPoints()[1]))
        .with(`${session.getBlocksSelected().length}`);
}];
