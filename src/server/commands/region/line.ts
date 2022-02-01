import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';
import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Pattern } from '@modules/pattern.js';
import { Mask } from '@modules/mask.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'line',
    description: 'commands.wedit:line.description',
    usage: [
        {
            name: 'pattern',
            type: 'Pattern',
        }
    ]
};

function bresenham3d(p1: Vector, p2: Vector) {
    const pointList: Vector[] = [];
    pointList.push(p1.clone());
    let d = p2.sub(p1).abs();
    let s = Vector.ZERO;
    
    s.x = p2.x > p1.x ? 1 : -1;
    s.y = p2.y > p1.y ? 1 : -1;
    s.z = p2.z > p1.z ? 1 : -1;
    
    // Driving axis is X-axis
    if (d.x >= d.y && d.x >= d.z) {        
        let sub1 = 2 * d.y - d.x;
        let sub2 = 2 * d.z - d.x;
        while (p1.x != p2.x) {
            p1 = p1.clone();
            p1.x += s.x;
            if (sub1 >= 0) {
                p1.y += s.y;
                sub1 -= 2 * d.x;
            }
            if (sub2 >= 0) {
                p1.z += s.z;
                sub2 -= 2 * d.x;
            }
            sub1 += 2 * d.y;
            sub2 += 2 * d.z;
            pointList.push(p1);
        }
    }
    // Driving axis is Y-axis
    else if (d.y >= d.x && d.y >= d.z) {       
        let sub1 = 2 * d.x - d.y;
        let sub2 = 2 * d.z - d.y;
        while (p1.y != p2.y) {
            p1 = p1.clone();
            p1.y += s.y;
            if (sub1 >= 0) {
                p1.x += s.x;
                sub1 -= 2 * d.y;
            }
            if (sub2 >= 0) {
                p1.z += s.z;
                sub2 -= 2 * d.y;
            }
            sub1 += 2 * d.x;
            sub2 += 2 * d.z;
            pointList.push(p1);
        }
    }
    // Driving axis is Z-axis
    else {        
        let sub1 = 2 * d.y - d.z;
        let sub2 = 2 * d.x - d.z;
        while (p1.z != p2.z) {
            p1 = p1.clone();
            p1.z += s.z;
            if (sub1 >= 0) {
                p1.y += s.y;
                sub1 -= 2 * d.z;
            }
            if (sub2 >= 0) {
                p1.x += s.x;
                sub2 -= 2 * d.z;
            }
            sub1 += 2 * d.y;
            sub2 += 2 * d.x;
            pointList.push(p1);
        }
    }
    
    return pointList;
}

commandList['line'] = [registerInformation, (session, builder, args) => {
    assertSelection(session);
    assertCanBuildWithin(PlayerUtil.getDimension(session.getPlayer())[1], ...session.getSelectionRange());
    if (session.usingItem && session.globalPattern.empty()) {
        throw RawText.translate('worldEdit.selectionFill.noPattern');
    }
    
    const dim = PlayerUtil.getDimension(session.getPlayer())[1];
    const pattern = session.usingItem ? session.globalPattern : args.get('pattern');

    const history = session.getHistory();
    history.record();

    if (session.selectionMode == 'cuboid') {
        var [pos1, pos2] = session.getSelectionPoints();
        var start = Vector.min(pos1, pos2).toBlock();
        var end = Vector.max(pos1, pos2).toBlock();
        history.addUndoStructure(start, end, 'any');
    }
    
    let count = 0;
    for (const point of bresenham3d(Vector.from(pos1), Vector.from(pos2))) {
        if (session.globalMask.matchesBlock(point.toBlock(), dim) && !pattern.setBlock(point.toBlock(), dim)) {
            count++;
        }
    }
    
    history.recordSelection(session);
    history.addRedoStructure(start, end, session.selectionMode == 'cuboid' ? 'any' : []);
    history.commit();

    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
}];
