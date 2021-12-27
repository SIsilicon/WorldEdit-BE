import { PlayerSession } from '../../sessions.js';
import { Pattern } from '@modules/pattern.js';
import { set } from '../region/set.js';
import { commandList } from '../command_list.js';
import { regionCenter } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { assertClipboard, assertCuboidSelection } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { RawText } from '@modules/rawtext.js';
import { Regions } from '@modules/regions.js';

const registerInformation = {
    name: 'rotate',
    description: 'commands.wedit:rotate.description',
    usage: [
        {
            flag: 'o'
        },
        {
            flag: 'c'
        },
        {
            flag: 's'
        },
        {
            name: 'rotate',
            type: 'int'
        }
    ]
};

commandList['rotate'] = [registerInformation, (session, builder, args) => {
    if ((Math.abs(args.get('rotate')) / 90) % 1 != 0) {
        throw RawText.translate('commands.wedit:rotate.not-ninety').with(args.get('rotate'));
    }
    
    let blockCount = 0;
    if (args.has('c')) {
        assertClipboard(builder);
        const [start, end] = Regions.getBounds('clipboard', builder);
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.add(Regions.getOrigin('clipboard', builder), start);
        
        Regions.rotate('clipboard', args.get('rotate'), center, builder);
        blockCount = Regions.getBlockCount('clipboard', builder);
    } else {
        assertCuboidSelection(session);
        const [pos1, pos2] = session.getSelectionPoints().slice(0, 2);
        
        const history = session.getHistory();
        history.record();
    
        if (session.selectionMode == 'cuboid') {
            var start = Vector.min(pos1, pos2).toBlock();
            var end = Vector.max(pos1, pos2).toBlock();
        }
        
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.from(PlayerUtil.getBlockLocation(builder));
        
        Regions.save('tempRotate', start, end, builder);
        Regions.rotate('tempRotate', args.get('rotate'), center, builder);
        blockCount = Regions.getBlockCount('tempRotate', builder);
        
        const [newPos1, newPos2] = Regions.getBounds('tempRotate', builder);
        history.addUndoStructure(start, end, 'any');
        history.addUndoStructure(newPos1, newPos2, 'any');
        
        set(session, new Pattern('air'));
        Regions.load('tempRotate', newPos1, builder);
        Regions.delete('tempRotate', builder);
        
        history.addRedoStructure(newPos1, newPos2, 'any');
        history.addRedoStructure(start, end, 'any');
        history.commit();
        
        if (args.has('s')) {
            session.setSelectionPoint(0, newPos1);
            session.setSelectionPoint(1, newPos2);
        }
    }
    
    return RawText.translate('commands.wedit:rotate.rotated').with(blockCount);
}];
