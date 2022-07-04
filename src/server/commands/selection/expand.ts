import { assertCuboidSelection } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { RawText } from '@notbeer-api';
import { Vector } from '@notbeer-api';
import { registerCommand } from '../register_commands.js';

// TODO: Support multiple directions at once (contract too)
const registerInformation = {
    name: 'expand',
    description: 'commands.wedit:expand.description',
    permission: 'worldedit.selection.expand',
    usage: [
        {
            subName: 'vert',
            args: [
                {
                    name: 'height',
                    type: 'int',
                    default: 384
                }
            ]
        },
        {
            subName: '_defaultA',
            args: [
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
        },
        {
            subName: '_defaultB',
            args: [
                {
                    name: 'amount',
                    type: 'int'
                },
                {
                    name: 'reverseAmount',
                    type: 'int'
                },
                {
                    name: 'direction',
                    type: 'Direction',
                    default: new Cardinal(Cardinal.Dir.FORWARD)
                }
            ]
        }

    ]
};

registerCommand(registerInformation, function (session, builder, args) {
    assertCuboidSelection(session);
    let points = session.selection.points.map(block => Vector.from(block));
    
    if (args.has('vert')) {
        var dir = new Vector(0, 1, 0);
        var dirIdx = 1;
        var side1 = args.get('height') as number;
        var side2 = args.get('height') as number;
    } else {
        var dir = (args.get('direction') as Cardinal).getDirection(builder);
        var dirIdx = dir.x ? 0 : (dir.y ? 1 : 2);
        var side1 = Math.max(-args.get('amount'), 0) + Math.max(args.get('reverseAmount') ?? 0, 0);
        var side2 = Math.max(args.get('amount'), 0) + Math.max(-(args.get('reverseAmount') ?? 0), 0);
    }

    let [minPoint, maxPoint] = [-1, -1];
    let [axis1, axis2] = [points[0].getIdx(dirIdx), points[1].getIdx(dirIdx)];
    if (dir.getIdx(dirIdx) >= 0) {
        [minPoint, maxPoint] = axis1 > axis2 ? [1, 0] : [0, 1];
    } else {
        [minPoint, maxPoint] = axis1 < axis2 ? [1, 0] : [0, 1];
    }

    points[minPoint] = points[minPoint].sub(dir.mul(side1));
    points[maxPoint] = points[maxPoint].add(dir.mul(side2));

    const beforeVol = session.selection.getBlockCount();
    session.selection.clear()
    session.selection.set(0, points[0].toBlock());
    session.selection.set(1, points[1].toBlock());
    const afterVol = session.selection.getBlockCount();

    return RawText.translate('commands.wedit:expand.explain').with(afterVol - beforeVol);
});
