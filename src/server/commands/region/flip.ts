import { PlayerSession } from '../../sessions.js';
import { Pattern } from '@modules/pattern.js';
import { set } from '../region/set.js';
import { commandList } from '../command_list.js';
import { regionCenter } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { assertClipboard, assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { Cardinal } from '@modules/directions.js';
import { RawText } from '@modules/rawtext.js';
import { Regions } from '@modules/regions.js';

const registerInformation = {
    name: 'flip',
    description: 'commands.wedit:flip.description',
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
            name: 'direction',
            type: 'Direction',
            default: new Cardinal(Cardinal.Dir.LEFT)
        }
    ]
};

commandList['flip'] = [registerInformation, (session, builder, args) => {
    const dir: Vector = args.get('direction').getDirection(builder);
    if (dir.y != 0) {
        throw RawText.translate('commands.wedit:flip.not-lateral');
    }
    
    let blockCount = 0;
    if (args.has('c')) {
        assertClipboard(builder);
        const [start, end] = Regions.getBounds('clipboard', builder);
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.add(Regions.getOrigin('clipboard', builder), start);
        
        Regions.flip('clipboard', dir, center, builder);
        blockCount = Regions.getBlockCount('clipboard', builder);
    } else {
        assertCuboidSelection(session);
        const history = session.getHistory();
        history.record();
    
        const [start, end] = session.getSelectionRange();
        const dim = PlayerUtil.getDimension(session.getPlayer())[1];
        assertCanBuildWithin(dim, start, end);
        
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.from(PlayerUtil.getBlockLocation(builder));
        
        Regions.save('tempFlip', start, end, builder);
        Regions.flip('tempFlip', dir, center, builder);
        blockCount = Regions.getBlockCount('tempFlip', builder);
        
        const [newStart, newEnd] = Regions.getBounds('tempFlip', builder);
        history.addUndoStructure(start, end, 'any');
        history.addUndoStructure(newStart, newEnd, 'any');
        
        try {
            assertCanBuildWithin(dim, newStart, newEnd);
        } catch (e) {
            Regions.delete('tempFlip', builder);
            throw e;
        }
        
        set(session, new Pattern('air'));
        if (Regions.load('tempFlip', newStart, builder)) {
            Regions.delete('tempFlip', builder);
            throw RawText.translate('commands.generic.wedit:commandFail');
        }
        Regions.delete('tempFlip', builder);
        
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
    
    return RawText.translate('commands.wedit:flip.explain').with(blockCount);
}];
