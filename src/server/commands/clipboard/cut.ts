import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder } from '@modules/assert.js';

import { getSession } from '../../sessions.js';
import { Vector } from '@modules/vector.js';
import { copy } from './copy.js';
import { set } from '../region/set.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js'
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'cut',
    description: 'commands.wedit:cut.description',
    usage: [
        {
            flag: 'a'
        }, {
            flag: 'e'
        }, {
            name: 'fill',
            type: 'Pattern',
            default: new Pattern('air')
        }, {
            flag: 'm',
            name: 'mask',
            type: 'Mask'
        }
    ]
};

commandList['cut'] = [registerInformation, (session, builder, args) => {
    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        const [pos1, pos2] = session.getSelectionPoints();
        var start = Vector.min(pos1, pos2).toBlock();
        var end = Vector.max(pos1, pos2).toBlock();
        history.addUndoStructure(start, end, 'any');
    }
    
    if (copy(session, args)) {
        throw RawText.translate('worldedit.error.command-fail');
    }

    let pattern: Pattern = args.get('fill');
    let mask: Mask = args.has('m') ? args.get('m-mask') : undefined;
    let includeEntities: boolean = session.usingItem ? session.includeEntities : args.has('e');

    set(session, pattern, mask);
    if (includeEntities) {
        const [dim, dimName] = PlayerUtil.getDimension(builder);
        for (const block of start.blocksBetween(end)) {
            for (const entity of dim.getEntitiesAtBlockLocation(block)) {
                entity.nameTag = 'wedit:marked_for_deletion';
            }
        }
        Server.runCommand('execute @e[name=wedit:marked_for_deletion] ~~~ tp @s ~ -256 ~', dimName);
        Server.runCommand('kill @e[name=wedit:marked_for_deletion]', dimName);
    }

    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();
    
    return RawText.translate('worldedit.cut.explain').with(`${session.getBlocksSelected().length}`);
}];
