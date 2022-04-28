import { registerCommand } from '../register_commands.js';
import { contentLog, RawText } from '@notbeer-api';
import { assertClipboard } from '@modules/assert.js';
import { transformSelection } from './transform_func.js';

const registerInformation = {
    name: 'rotate',
    permission: 'worldedit.region.rotate',
    description: 'commands.wedit:rotate.description',
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
            name: 'rotate',
            type: 'int'
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    if ((Math.abs(args.get('rotate')) / 90) % 1 != 0) {
        throw RawText.translate('commands.wedit:rotate.not-ninety').with(args.get('rotate'));
    }
    let blockCount = 0;
    if (args.has('c')) {
        assertClipboard(session);
        if (!args.has('o')) {
            session.clipboardTransform.relative = session.clipboardTransform.relative.rotate(args.get('rotate'))
        }
        session.clipboardTransform.rotation += args.get('rotate');
        blockCount = session.clipboard.getBlockCount();
    } else {
        yield* transformSelection(session, builder, args, {rotation: args.get('rotate')});
        blockCount = session.getSelectedBlockCount();
    }

    return RawText.translate('commands.wedit:rotate.explain').with(blockCount);
});
