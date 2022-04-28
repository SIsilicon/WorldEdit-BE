import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Pattern } from '@modules/pattern.js';
import { RawText, regionCenter, regionTransformedBounds, StructureLoadOptions, Vector } from '@notbeer-api';
import { Player } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { set } from './set.js';

export function* transformSelection(session: PlayerSession, builder: Player, args: Map<string, any>, options: StructureLoadOptions): Generator<void> {
    assertCuboidSelection(session);
    const history = session.getHistory();
    const record = history.record();
    const temp = session.createRegion(true);
    try {
        const [start, end] = session.getSelectionRange();
        const dim = builder.dimension;
        assertCanBuildWithin(dim, start, end);
        
        const center = Vector.from(start).add(end).mul(0.5);
        const origin = args.has('o') ? Vector.ZERO : Vector.sub(center, Vector.from(builder.location).floor());
        temp.save(start, end, dim);
        
        let [newStart, newEnd] = regionTransformedBounds(start, end, center.sub(origin), options);
                
        history.addUndoStructure(record, start, end, 'any');
        history.addUndoStructure(record, newStart, newEnd, 'any');

        assertCanBuildWithin(dim, newStart, newEnd);

        yield* set(session, new Pattern('air'));
        if (temp.load(newStart, dim, options)) {
            throw RawText.translate('commands.generic.wedit:commandFail');
        }
        
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
    } finally {
        session.deleteRegion(temp);
    }
}