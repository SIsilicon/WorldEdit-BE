import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';
import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { CuboidShape } from '../../shapes/cuboid.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'faces',
    permission: 'worldedit.region.faces',
    description: 'commands.wedit:faces.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern',
        }
    ]
};

commandList['faces'] = [registerInformation, (session, builder, args) => {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    if (session.usingItem && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const pattern = session.usingItem ? session.globalPattern : args.get('pattern');
    
    let count = 0;
    let [start, end] = session.getSelectionRange();
    if (session.selectionMode == 'cuboid') {
        const size = Vector.sub(end, start).add(Vector.ONE);
        count = new CuboidShape(size.x, size.y, size.z).generate(start, pattern, null, session, {hollow: true});
    }
    
    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
}];
