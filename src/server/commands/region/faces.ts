import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Jobs } from '@modules/jobs.js';
import { RawText } from '@notbeer-api';
import { Vector } from '@notbeer-api';
import { CuboidShape } from '../../shapes/cuboid.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'faces',
    permission: 'worldedit.region.faces',
    description: 'commands.wedit:faces.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    if (args.get('_using_item') && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const pattern = args.get('_using_item') ? session.globalPattern : args.get('pattern');
    
    let [shape, loc] = session.getSelectionShape();
    const job = Jobs.startJob(session, 2, session.getSelectionRange());
    const count = yield* Jobs.perform(job, shape.generate(loc, pattern, null, session, {hollow: true}));
    Jobs.finishJob(job);
    
    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
});
