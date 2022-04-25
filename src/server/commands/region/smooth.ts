import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Jobs } from '@modules/jobs.js';
import { Mask } from '@modules/mask.js';
import { RawText } from '@notbeer-api';
import { Regions } from '@modules/regions.js';
import { Vector } from '@notbeer-api';
import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { Shape } from '../../shapes/base_shape.js';
import { CuboidShape } from '../../shapes/cuboid.js';
import { getWorldMinY, getWorldMaxY } from '../../util.js';
import { registerCommand } from '../register_commands.js';
import { smooth } from './smooth_func.js';

const registerInformation = {
    name: 'smooth',
    permission: 'worldedit.region.smooth',
    description: 'commands.wedit:smooth.description',
    usage: [
        {
            name: 'iterations',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        },
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    
    let count = 0;
    let [start, end] = session.getSelectionRange();
    if (session.selectionMode == 'cuboid' || session.selectionMode == 'extend') {
        const size = Vector.sub(end, start).add(Vector.ONE);
        const shape = new CuboidShape(size.x, size.y, size.z);
        const job = Jobs.startJob(builder, 2 + args.get('iterations') * 2)
        count = yield* smooth(session, args.get('iterations'), shape, start, args.get('mask'), null, job);
    }
    
    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
});
