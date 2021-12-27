import { PlayerSession } from '../../sessions.js';
import { Pattern } from '@modules/pattern.js';
import { set } from '../region/set.js';
import { commandList } from '../command_list.js';
import { regionCenter } from '../../util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { assertClipboard, assertCuboidSelection } from '@modules/assert.js';
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
        const [pos1, pos2] = session.getSelectionPoints().slice(0, 2);
        
        const history = session.getHistory();
        history.record();
    
        if (session.selectionMode == 'cuboid') {
            var start = Vector.min(pos1, pos2).toBlock();
            var end = Vector.max(pos1, pos2).toBlock();
        }
        
        const center = args.has('o') ? Vector.from(start).lerp(end, 0.5) : Vector.from(PlayerUtil.getBlockLocation(builder));
        
        Regions.save('tempFlip', start, end, builder);
        Regions.flip('tempFlip', dir, center, builder);
        blockCount = Regions.getBlockCount('tempFlip', builder);
        
        const [newPos1, newPos2] = Regions.getBounds('tempFlip', builder);
        history.addUndoStructure(start, end, 'any');
        history.addUndoStructure(newPos1, newPos2, 'any');
        
        set(session, new Pattern('air'));
        Regions.load('tempFlip', newPos1, builder);
        Regions.delete('tempFlip', builder);
        
        history.addRedoStructure(newPos1, newPos2, 'any');
        history.addRedoStructure(start, end, 'any');
        history.commit();
        
        if (args.has('s')) {
            session.setSelectionPoint(0, newPos1);
            session.setSelectionPoint(1, newPos2);
        }
    }
    
    return RawText.translate('commands.wedit:flip.flipped').with(blockCount);
}];
