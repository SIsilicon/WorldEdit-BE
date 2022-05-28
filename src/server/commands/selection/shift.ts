import { assertSelection } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { Vector } from '@notbeer-api';
import { registerCommand } from '../register_commands.js';

const registerInformation = {
    name: 'shift',
    description: 'commands.wedit:shift.description',
    permission: 'worldedit.selection.shift',
    usage: [
        {
            name: 'amount',
            type: 'int'
        },
        {
            name: 'direction',
            type: 'Direction',
            default: new Cardinal(Cardinal.Dir.FORWARD)
        }
    ]
};

registerCommand(registerInformation, function (session, builder, args) {
    assertSelection(session);
    let points = session.selection.points.map(block => Vector.from(block));
    const dir = (args.get('direction') as Cardinal).getDirection(builder).mul(args.get('amount'));

    session.selection.clear();
    points.forEach((point, idx) => {
        session.selection.set(idx ? 1 : 0, point.add(dir).toBlock());
    });

    return 'commands.wedit:shift.explain';
});
