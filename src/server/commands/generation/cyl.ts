import { BlockLocation } from 'mojang-minecraft';
import { Pattern } from '@modules/pattern.js';
import { RawText } from '@modules/rawtext.js';
import { CylinderShape } from '../../shapes/cylinder.js';
import { PlayerUtil } from '@modules/player_util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'cyl',
    description: 'commands.wedit:cyl.description',
    usage: [
        {
            flag: 'h'
        }, {
            flag: 'r'
        }, {
            name: 'pattern',
            type: 'Pattern'
        }, {
            subName: '_x',
            args: [
                {
                    name: 'radii',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'height',
                    type: 'int',
                    range: [1, null] as [number, null],
                    default: 1
                }
            ]
        }, {
            subName: '_xz',
            args: [
                {
                    name: 'radiiX',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'radiiZ',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'height',
                    type: 'int',
                    range: [1, null] as [number, null],
                    default: 1
                }
            ]
        }
    ]
};

commandList['cyl'] = [registerInformation, (session, builder, args) => {
    let pattern: Pattern = args.get('pattern');
    let radii: [number, number];
    let height: number = args.get('height');
    let isHollow = args.has('h');
    let isRaised = args.has('r');
    
    if (args.has('_x'))
        radii = [args.get('radii'), args.get('radii')];
    else
        radii = [args.get('radiiX'), args.get('radiiZ')];

    const loc = PlayerUtil.getBlockLocation(builder).offset(0, isRaised ? height/2 : 0, 0);
    
    const cylShape = new CylinderShape(height, ...<[number, number]>radii);
    const count = cylShape.generate(loc, pattern, null, session, {'hollow': isHollow});

    return RawText.translate('worldedit.generate.created').with(`${count}`);
}];
