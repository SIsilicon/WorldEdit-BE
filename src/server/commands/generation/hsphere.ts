import { Server } from '@library/Minecraft.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'hsphere',
    description: 'Generate a hollow sphere.',
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
                }
            ]
        }, {
            subName: '_xy',
            args: [
                {
                    name: 'radiiXZ',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'radiiY',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }
            ]
        }, {
            subName: '_xyz',
            args: [
                {
                    name: 'radiiX',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'radiiY',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }, {
                    name: 'radiiZ',
                    type: 'float',
                    range: [0.01, null] as [number, null]
                }
            ]
        }
    ]
};

commandList['hsphere'] = [registerInformation, (session, builder, args) => {
    args.set('h', true);
    return commandList['sphere'][1](session, builder, args);
}];
