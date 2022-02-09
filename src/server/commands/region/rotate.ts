import { PlayerSession } from '../../sessions.js';
import { Pattern } from '@modules/pattern.js';
import { set } from '../region/set.js';
import { commandList } from '../command_list.js';
import { regionCenter } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { assertClipboard, assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { RawText } from '@modules/rawtext.js';
import { Regions } from '@modules/regions.js';

const registerInformation = {
    name: 'rotate',
    permission: 'worldedit.region.rotate',
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
        const history = session.getHistory();
        history.record();
    
        const [start, end] = session.getSelectionRange();
        const dim = builder.dimension;
        assertCanBuildWithin(dim, start, end);
        
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.from(PlayerUtil.getBlockLocation(builder));
        
        Regions.save('tempRotate', start, end, builder);
        Regions.rotate('tempRotate', args.get('rotate'), center, builder);
        blockCount = Regions.getBlockCount('tempRotate', builder);
        
        const [newStart, newEnd] = Regions.getBounds('tempRotate', builder);
        history.addUndoStructure(start, end, 'any');
        history.addUndoStructure(newStart, newEnd, 'any');
        
        try {
            assertCanBuildWithin(dim, newStart, newEnd);
        } catch (e) {
            Regions.delete('tempRotate', builder);
            throw e;
        }
        
        set(session, new Pattern('air'));
        if (Regions.load('tempRotate', newStart, builder)) {
            Regions.delete('tempRotate', builder);
            throw RawText.translate('commands.generic.wedit:commandFail');
        }
        Regions.delete('tempRotate', builder);
        
        if (args.has('s')) {
            history.recordSelection(session);
            session.setSelectionPoint(0, newStart);
            session.setSelectionPoint(1, newEnd);
            history.recordSelection(session);
        }
        
        history.addRedoStructure(newStart, newEnd, 'any');
        history.addRedoStructure(start, end, 'any');
        history.commit();
    }
    
    return RawText.translate('commands.wedit:rotate.explain').with(blockCount);
}];
