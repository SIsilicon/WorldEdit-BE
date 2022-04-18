;
import { set } from './set.js';
import { registerCommand } from '../register_commands.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@library/Minecraft.js';
import { Regions } from '@modules/regions.js';

const registerInformation = {
    name: 'move',
    permission: 'worldedit.region.move',
    description: 'commands.wedit:move.description',
    usage: [
        {
            name: 'amount',
            type: 'int',
            default: 1,
            range: [1, null] as [number, null]
        }, {
            name: 'offset',
            type: 'Direction',
            default: new Cardinal()
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    const dir = args.get('offset').getDirection(builder).mul(args.get('amount'));
    const dim = builder.dimension;
    
    const [start, end] = session.getSelectionRange();
    const movedStart = start.offset(dir.x, dir.y, dir.z);
    const movedEnd = end.offset(dir.x, dir.y, dir.z);
    
    assertCanBuildWithin(dim, start, end);
    assertCanBuildWithin(dim, movedStart, movedEnd);
    
    const history = session.getHistory();
    const record = history.record();
    try {

        history.addUndoStructure(record, start, end, 'any');
        history.addUndoStructure(record, movedStart, movedEnd, 'any');    
        
        Regions.save('tempMove', start, end, builder);
        var count = yield* set(session, new Pattern('air'));
        Regions.load('tempMove', movedStart, builder);
        count += Regions.getBlockCount('tempMove', builder);
        Regions.delete('tempMove', builder);
        
        history.addRedoStructure(record, start, end, 'any');
        history.addRedoStructure(record, movedStart, movedEnd, 'any');
        history.commit(record);
    } catch (e) {
        history.cancel(record);
        throw e;
    }
    
    return RawText.translate('commands.wedit:move.explain').with(count);
});
