import { commandList } from '../command_list.js';
import { ExpressionShape } from '../../shapes/expression.js';
import { regionSize } from '../../util.js';
import { assertCuboidSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@modules/rawtext.js';
import { Vector } from '@modules/vector.js';

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

commandList['gen'] = [registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    
    const [start, end] = session.getSelectionPoints();

    let pattern: Pattern = args.get('pattern');
    let isHollow = args.has('h');
    
    const exprShape = new ExpressionShape(Vector.from(regionSize(start, end)), args.get('expr'));
    const count = yield* exprShape.generate(Vector.min(start, end).toBlock(), pattern, null, session, {'hollow': isHollow});

    return RawText.translate('commands.blocks.wedit:created').with(`${count}`);
}];
