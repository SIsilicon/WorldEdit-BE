import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
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
    permission: 'worldedit.clipboard.cut',
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
    assertCuboidSelection(session);
    const dim = builder.dimension;
    const [start, end] = session.getSelectionRange();
    assertCanBuildWithin(dim, start, end);
    
    const history = session.getHistory();
    history.record();
    history.recordSelection(session);
    
    history.addUndoStructure(start, end, 'any');
    
    if (copy(session, args)) {
        throw RawText.translate('commands.generic.wedit:commandFail');
    }

    let pattern: Pattern = args.get('fill');
    let mask: Mask = args.has('m') ? args.get('m-mask') : undefined;
    let includeEntities: boolean = session.usingItem ? session.includeEntities : args.has('e');

    set(session, pattern, mask);
    if (includeEntities) {
        for (const block of start.blocksBetween(end)) {
            for (const entity of dim.getEntitiesAtBlockLocation(block)) {
                entity.nameTag = 'wedit:marked_for_deletion';
            }
        }
        Server.runCommand('execute @e[name=wedit:marked_for_deletion] ~~~ tp @s ~ -256 ~', dim);
        Server.runCommand('kill @e[name=wedit:marked_for_deletion]', dim);
    }

    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();
    
    return RawText.translate('commands.wedit:cut.explain').with(`${session.getBlocksSelected().length}`);
}];
