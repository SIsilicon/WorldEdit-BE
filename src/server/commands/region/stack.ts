import { Player, BlockLocation } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { regionSize, printDebug } from '../../util.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@modules/rawtext.js';
import { Regions } from '@modules/regions.js';
import { assertCanBuildWithin, assertCuboidSelection } from '@modules/assert.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'stack',
    permission: 'worldedit.region.stack',
    description: 'commands.wedit:stack.description',
    usage: [
        {
            name: 'count',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }, {
            name: 'offset',
            type: 'Direction',
            default: new Cardinal()
        }
    ]
};

commandList['stack'] = [registerInformation, (session, builder, args) => {
    assertCuboidSelection(session);
    const amount = args.get('count');
    const [start, end] = session.getSelectionRange();
    const size = regionSize(start, end);
    
    const dir = args.get('offset').getDirection(builder).mul(size);
    let loadStart = start.offset(dir.x, dir.y, dir.z);
    let loadEnd = end.offset(dir.x, dir.y, dir.z);
    let count = 0;
    
    const loads: [BlockLocation, BlockLocation][] = [];
    for (let i = 0; i < amount; i++) {
        assertCanBuildWithin(builder.dimension, loadStart, loadEnd);
        loads.push([loadStart, loadEnd]);
        loadStart = loadStart.offset(dir.x, dir.y, dir.z);
        loadEnd = loadEnd.offset(dir.x, dir.y, dir.z);
    }
    
    const history = session.getHistory();
    history.record();
    Regions.save('tempStack', start, end, builder);
    for (const load of loads) {
        history.addUndoStructure(load[0], load[1], 'any');
        Regions.load('tempStack', load[0], builder);
        history.addRedoStructure(load[0], load[1], 'any');
        count += Regions.getBlockCount('tempStack', builder);
    }
    Regions.delete('tempStack', builder);
    history.commit();
    
    return RawText.translate('commands.wedit:stack.explain').with(count);
}];
