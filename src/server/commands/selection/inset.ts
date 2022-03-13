import { commandList } from '../command_list.js';
import { assertCuboidSelection } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';

const registerInformation = {
    name: 'inset',
    description: 'commands.wedit:inset.description',
    permission: 'worldedit.selection.inset',
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

commandList['inset'] = [registerInformation, (session, builder, args) => {
    assertCuboidSelection(session);
    let points = session.getSelectionPoints().map(block => Vector.from(block));
    let dir = points[1].sub(points[0]);
    dir.x = Math.sign(dir.x) * (args.has('v') ? 0 : 1);
    dir.y = Math.sign(dir.y) * (args.has('h') ? 0 : 1);
    dir.z = Math.sign(dir.z) * (args.has('v') ? 0 : 1);
    
    points[0] = points[0].add(dir.mul(args.get('amount')));
    points[1] = points[1].sub(dir.mul(args.get('amount')));
    
    session.clearSelectionPoints()
    session.setSelectionPoint(0, points[0].toBlock());
    session.setSelectionPoint(1, points[1].toBlock());

    return 'commands.wedit:inset.explain';
}];