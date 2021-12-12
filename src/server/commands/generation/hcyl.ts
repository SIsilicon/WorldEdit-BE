import { Server } from '@library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'hcyl',
    description: 'Generate a hollow cylinder.',
    usage: [
        {
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

commandList['hcyl'] = [registerInformation, (session, builder, args) => {
    args.set('h', true);
    return commandList['cyl'][1](session, builder, args);
}];
