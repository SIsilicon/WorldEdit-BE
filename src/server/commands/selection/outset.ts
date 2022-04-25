import { assertCuboidSelection } from '@modules/assert.js';
import { Vector } from '@notbeer-api';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'outset',
    description: 'commands.wedit:outset.description',
    permission: 'worldedit.selection.outset',
    usage: [
        {
            flag: 'h'
        },
        {
            flag: 'v'
        },
        {
            name: 'amount',
            type: 'int'
        }
    ]
};

registerCommand(registerInformation, function (session, builder, args) {
    assertCuboidSelection(session);
    let points = session.getSelectionPoints().map(block => Vector.from(block));
    let dir = points[1].sub(points[0]);
    dir.x = Math.sign(dir.x) * (args.has('v') ? 0 : 1);
    dir.y = Math.sign(dir.y) * (args.has('h') ? 0 : 1);
    dir.z = Math.sign(dir.z) * (args.has('v') ? 0 : 1);
    
    points[0] = points[0].sub(dir.mul(args.get('amount')));
    points[1] = points[1].add(dir.mul(args.get('amount')));
    
    session.clearSelectionPoints()
    session.setSelectionPoint(0, points[0].toBlock());
    session.setSelectionPoint(1, points[1].toBlock());

    return 'commands.wedit:outset.explain';
});
