import { Jobs } from '@modules/jobs.js';
import { Pattern } from '@modules/pattern.js';
import { RawText, Vector } from '@notbeer-api';
import { CuboidShape } from '../../shapes/cuboid.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'removenear',
    permission: 'worldedit.utility.removenear',
    description: 'commands.wedit:removenear.description',
    usage: [
        {
            name: 'mask',
            type: 'Mask'
        },
        {
            name: 'size',
            type: 'int'
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    // TODO: Assert Can Build within

    const size = (args.get('size') - 1) * 2 + 1;
    const origin = Vector.from(builder.location).floor().sub(size / 2).ceil();

    const shape = new CuboidShape(size, size, size);
    const job = Jobs.startJob(builder, 2);
    const sessionMask = session.globalMask;
    try {
        session.globalMask = null;
        const count = yield* Jobs.perform(job, shape.generate(origin.toBlock(), new Pattern('air'), args.get('mask'), session));
        return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
    } finally {
        session.globalMask = sessionMask;
        Jobs.finishJob(job);
    }
});
