import { Pattern } from '@modules/pattern.js';
import { RawText, Vector } from '@notbeer-api';
import { CuboidShape } from '../../shapes/cuboid.js';
import { getWorldMaxY } from '../../util.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'removeabove',
    permission: 'worldedit.utility.removeabove',
    description: 'commands.wedit:removeabove.description',
    usage: [
        {
            name: 'size',
            type: 'int'
        },
        {
            name: 'height',
            type: 'int',
            range: [1, null] as [number, null],
            default: -1
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    // TODO: Assert Can Build within

    const size = (args.get('size') - 1) * 2 + 1;
    const height: number = args.get('height') == -1 ? getWorldMaxY(builder) - Math.floor(builder.location.y) + 1 : args.get('height');
    const origin = Vector.from(builder.location).floor().sub([size/2, 0, size/2]).ceil();
    
    const shape = new CuboidShape(size, height, size);
    const sessionMask = session.globalMask;
    try {
        session.globalMask = null;
        const count = yield* shape.generate(origin.toBlock(), new Pattern('air'), null, session);
        return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
    } finally {
        session.globalMask = sessionMask;
    }
});
