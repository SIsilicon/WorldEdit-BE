import { registerCommand } from '../register_commands.js';
import { ExpressionShape } from '../../shapes/expression.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Pattern } from '@modules/pattern.js';
import { RawText, Vector, regionSize } from '@notbeer-api';
import { Jobs } from '@modules/jobs.js';

const registerInformation = {
    name: 'gen',
    permission: 'worldedit.generation.shape',
    description: 'commands.wedit:gen.description',
    usage: [
        {
            flag: 'h'
        }, {
            name: 'pattern',
            type: 'Pattern'
        }, {
            name: 'expr',
            type: 'Expression'
        }
    ],
    aliases: ['g']
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.selection.getRange());
    
    const [start, end] = session.selection.points;

    let pattern: Pattern = args.get('pattern');
    let isHollow = args.has('h');
    
    const loc = Vector.min(start, end).toBlock()
    const exprShape = new ExpressionShape(Vector.from(regionSize(start, end)), args.get('expr'));
    const job = Jobs.startJob(session, 2, exprShape.getRegion(loc));
    const count = yield* Jobs.perform(job, exprShape.generate(loc, pattern, null, session, {'hollow': isHollow}));
    Jobs.finishJob(job);

    return RawText.translate('commands.blocks.wedit:created').with(`${count}`);
});
