import { getPlayerBlockLocation, printLocation } from '../../util.js';
import { parsePosition } from './selection_helper.js';
import { commandList } from '../command_list.js';
import { RawText } from '../../modules/rawtext.js';
const registerInformation = {
    cancelMessage: true,
    name: 'pos1',
    description: 'Set the first position of your selection to the specified or current position',
    usage: '[coordinates: xyz]',
};
commandList['pos1'] = [registerInformation, (session, builder, args) => {
        let loc = PlayerUtil.getBlockLocation(builder);
        if (args.length > 0) {
            loc = parsePosition(args, loc);
        }
        session.setSelectionPoint(0, loc);
        let translate;
        if (session.getBlocksSelected().length == 0) {
            translate = 'worldedit.selection.cuboid.explain.primary';
        }
        else {
            translate = 'worldedit.selection.cuboid.explain.primary-area';
        }
        return RawText.translate(translate)
            .with(printLocation(session.getSelectionPoints()[0]))
            .with(`${session.getBlocksSelected().length}`);
    }];
