import { set } from '../region/set.js';
import { registerCommand } from '../register_commands.js';
import { assertClipboard, assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { PlayerUtil } from '@modules/player_util.js';
import { RawText } from '@notbeer-api';
import { Regions } from '@modules/regions.js';
import { Vector } from '@notbeer-api';
;

const registerInformation = {
    name: 'flip',
    permission: 'worldedit.region.flip',
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

registerCommand(registerInformation, function* (session, builder, args) {
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
        const record = history.record();
        try {
            const [start, end] = session.getSelectionRange();
            const dim = builder.dimension;
            assertCanBuildWithin(dim, start, end);
            
            const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.from(PlayerUtil.getBlockLocation(builder));
            
            Regions.save('tempFlip', start, end, builder);
            Regions.flip('tempFlip', dir, center, builder);
            blockCount = Regions.getBlockCount('tempFlip', builder);
            
            const [newStart, newEnd] = Regions.getBounds('tempFlip', builder);
            history.addUndoStructure(record, start, end, 'any');
            history.addUndoStructure(record, newStart, newEnd, 'any');
            
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
                history.recordSelection(record, session);
                session.setSelectionPoint(0, newStart);
                session.setSelectionPoint(1, newEnd);
                history.recordSelection(record, session);
            }
            
            history.addRedoStructure(record, newStart, newEnd, 'any');
            history.addRedoStructure(record, start, end, 'any');
            history.commit(record);    
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    }
    
    return RawText.translate('commands.wedit:flip.explain').with(blockCount);
});
