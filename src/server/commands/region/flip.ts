import { registerCommand } from '../register_commands.js';
import { assertClipboard } from '@modules/assert.js';
import { Cardinal } from '@modules/directions.js';
import { contentLog, RawText, Vector } from '@notbeer-api';
import { transformSelection } from './transform_func.js';

const registerInformation = {
    name: 'flip',
    permission: 'worldedit.region.flip',
    description: 'commands.wedit:flip.description',
    usage: [
        {
            flag: 'o'
        },
        {
            flag: 'c'
        },
        {
            flag: 's'
        },
        {
            name: 'direction',
            type: 'Direction',
            default: new Cardinal(Cardinal.Dir.LEFT)
        }
    ]
};

const flipBits = { 0b00: 'none', 0b01: 'x', 0b10: 'z', 0b11: 'xz' } as {[key: number]: 'none'|'x'|'z'|'xz'};

registerCommand(registerInformation, function* (session, builder, args) {
    const dir: Vector = args.get('direction').getDirection(builder);
    if (dir.y != 0) {
        throw 'commands.wedit:flip.notLateral';
    }
    
    let blockCount = 0;
    // TODO: Support stacking rotations and flips
    if (args.has('c')) {
        assertClipboard(session);
        const clipboardTrans = session.clipboardTransform;
        if (!args.has('o')) {
            if (Math.abs(dir.x)) {
                clipboardTrans.relative.x *= -1;
            } else if (Math.abs(dir.z)) {
                clipboardTrans.relative.z *= -1;
            }
        }

        let dirBits = (clipboardTrans.flip.includes('z') ? 2 : 0) + (clipboardTrans.flip.includes('x') ? 1 : 0);
        dirBits ^= 0b10 * Math.abs(dir.x);
        dirBits ^= 0b01 * Math.abs(dir.z);
        clipboardTrans.flip = flipBits[dirBits] as typeof clipboardTrans.flip;
        blockCount = session.clipboard.getBlockCount();
    } else {
        yield* transformSelection(session, builder, args, {flip: flipBits[2 * Math.abs(dir.x) + Math.abs(dir.z)]});
        blockCount = session.getSelectedBlockCount();
    }
    
    return RawText.translate('commands.wedit:flip.explain').with(blockCount);
});
