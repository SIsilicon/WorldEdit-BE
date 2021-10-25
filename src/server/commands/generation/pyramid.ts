import { BlockLocation } from 'mojang-minecraft';
import { assertPositiveInt, assertValidInteger } from '../../modules/assert.js';
import { Pattern } from '../../modules/pattern.js';
import { RawText } from '../../modules/rawtext.js';
import { getSession, PlayerSession } from '../../sessions.js';
import { getPlayerBlockLocation, getPlayerDimension, getWorldMaxY, getWorldMinY } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'pyramid',
    description: 'Generate a filled pyramid.',
    usage: '[-h] <pattern: Patterm> <size: int>',
};

function generatePyramid(session: PlayerSession, loc: BlockLocation, size: number, pattern: Pattern, isHollow: boolean) {
    const min = loc.offset(-size+1, 0, -size+1);
    const max = loc.offset(size-1, size-1, size-1);

    const dimension = getPlayerDimension(session.getPlayer())[1];
    
    const minY = getWorldMinY(session.getPlayer());
    min.y = Math.max(minY, min.y);
    const maxY = getWorldMaxY(session.getPlayer());
    max.y = Math.min(maxY, max.y);
    let canGenerate = max.y >= min.y;

    const blocksAffected = [];
    if (canGenerate) {
        for (const block of min.blocksBetween(max)) {
            if (!session.globalMask.matchesBlock(block, dimension)) {
                continue;
            }
            const latSize = size - (block.y - min.y) - 0.5;
            const local = [
                block.x - loc.x,
                block.z - loc.z,
            ];
            
            if (isHollow) {
                const hLatSize = latSize - 1;
                if (local[0] > -hLatSize && local[0] < hLatSize && local[1] > -hLatSize && local[1] < hLatSize) {
                    continue;
                }
            }
            
            if (local[0] > -latSize && local[0] < latSize && local[1] > -latSize && local[1] < latSize) {
                blocksAffected.push(block);
            }
        }
    }

    const history = session.getHistory();
    history.record();
    
    let count = 0;
    if (canGenerate) {
        history.addUndoStructure(min, max, blocksAffected);
        for (const block of blocksAffected) {
            if (!pattern.setBlock(block, dimension)) {
                count++;
            }
        }
        history.addRedoStructure(min, max, blocksAffected);
    }
    
    history.commit();

    return count;
}

commandList['pyramid'] = [registerInformation, (session, builder, args) => {
    if (args.length < 2) throw 'This command expects at least two arguments!';
    
    let pattern: Pattern;
    let size: number;
    let isHollow = false;
    for (const arg of args) {
        if (arg == '-h') {
            isHollow = true;
        } else if (!pattern) {
            pattern = Pattern.parseArg(arg);
        } else if (!size) {
            size = parseInt(arg);
            assertValidInteger(size, arg);
            assertPositiveInt(size);
        }
    }
    
    if (!pattern) throw 'Pattern not defined!';
    if (!size) throw 'Size not defined!';

    const loc = getPlayerBlockLocation(builder);
    const count = generatePyramid(session, loc, size, pattern, isHollow);

    return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
