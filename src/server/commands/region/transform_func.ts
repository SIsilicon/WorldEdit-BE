import { FAST_MODE } from '@config.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Pattern } from '@modules/pattern.js';
import { RegionLoadOptions } from '@modules/region_buffer.js';
import { RawText, regionTransformedBounds, Vector } from '@notbeer-api';
import { Player } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { set } from './set.js';

// TODO: fix the bounds sometimes not encompassing the new geometry
export function* transformSelection(session: PlayerSession, builder: Player, args: Map<string, any>, options: RegionLoadOptions): Generator<number | string> {
    assertCuboidSelection(session);
    const history = session.getHistory();
    const record = history.record();
    const temp = session.createRegion(!FAST_MODE);
    try {
        const [start, end] = session.getSelectionRange();
        const dim = builder.dimension;
        assertCanBuildWithin(dim, start, end);
        
        const center = Vector.from(start).add(end).mul(0.5);
        const origin = args.has('o') ? Vector.ZERO : center.sub(builder.location).floor();
        yield 'Gettings blocks...';
        yield* temp.saveProgressive(start, end, dim);
        
        let [newStart, newEnd] = regionTransformedBounds(
            start, end, center.sub(origin),
            options.rotation ?? Vector.ZERO, options.flip ?? Vector.ONE
        );
        
        history.addUndoStructure(record, start, end, 'any');
        history.addUndoStructure(record, newStart, newEnd, 'any');
        
        assertCanBuildWithin(dim, newStart, newEnd);

        yield* set(session, new Pattern('air'), null, false);
        yield 'Transforming blocks...';
        if (yield* temp.loadProgressive(newStart, dim, options)) {
            throw 'commands.generic.wedit:commandFail';
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