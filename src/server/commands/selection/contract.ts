import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';
import { Cardinal } from '@modules/directions.js';
import { assertCuboidSelection } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';

const registerInformation = {
    name: 'contract',
    description: 'commands.wedit:contract.description',
    permission: 'worldedit.selection.contract',
    usage: [
        {
            name: 'amount',
            type: 'int'
        },
        {
            name: 'reverseAmount',
            type: 'int',
            default: 0
        },
        {
            name: 'direction',
            type: 'Direction',
            default: new Cardinal(Cardinal.Dir.FORWARD)
        }
    ]
};

commandList['contract'] = [registerInformation, (session, builder, args) => {
    assertCuboidSelection(session);
    let points = session.getSelectionPoints().map(block => Vector.from(block));
    const dir = (args.get('direction') as Cardinal).getDirection(builder);
    
    let dirIdx: 0|1|2 = 0;
    if (dir.y) {
        dirIdx = 1;
    } else if (dir.z) {
        dirIdx = 2;
    }
    
    let side1 = Math.max(args.get('amount'), 0) + Math.max(-args.get('reverseAmount'), 0);
    let side2 = Math.max(-args.get('amount'), 0) + Math.max(args.get('reverseAmount'), 0);
    
    let [minPoint, maxPoint] = [-1, -1];
    let [axis1, axis2] = [points[0].getIdx(dirIdx), points[1].getIdx(dirIdx)];
    if (dir.getIdx(dirIdx) >= 0) {
        [minPoint, maxPoint] = axis1 > axis2 ? [1, 0] : [0, 1];
    } else {
        [minPoint, maxPoint] = axis1 < axis2 ? [1, 0] : [0, 1];
    }

    points[minPoint] = points[minPoint].add(dir.mul(side1));
    points[maxPoint] = points[maxPoint].sub(dir.mul(side2));

    const beforeVol = session.getSelectedBlockCount();
    session.clearSelectionPoints()
    session.setSelectionPoint(0, points[0].toBlock());
    session.setSelectionPoint(1, points[1].toBlock());
    const afterVol = session.getSelectedBlockCount();

    return RawText.translate('commands.wedit:contract.explain').with(beforeVol - afterVol);
}];
