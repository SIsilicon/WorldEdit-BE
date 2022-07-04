import { Jobs } from '@modules/jobs.js';
import { Pattern } from '@modules/pattern.js';
import { RawText, Vector } from '@notbeer-api';
import { CuboidShape } from '../../shapes/cuboid.js';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'replacenear',
    permission: 'worldedit.utility.replacenear',
    description: 'commands.wedit:replacenear.description',
    usage: [
        {
            name: 'size',
            type: 'int'
        },
        {
            name: 'mask',
            type: 'Mask'
        },
        {
            name: 'pattern',
            type: 'Pattern'
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    // TODO: Assert Can Build within

    const size = (args.get('size') - 1) * 2 + 1;
    const origin = Vector.from(builder.location).floor().sub(size / 2).ceil().toBlock();

    const shape = new CuboidShape(size, size, size);
    const job = Jobs.startJob(session, 2, shape.getRegion(origin));
    const sessionMask = session.globalMask;
    try {
        session.globalMask = null;
        const count = yield* Jobs.perform(job, shape.generate(origin, args.get('pattern'), args.get('mask'), session));
        return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
    } finally {
        session.globalMask = sessionMask;
        Jobs.finishJob(job);
    }
});
