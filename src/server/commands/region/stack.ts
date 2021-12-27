import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { regionSize, printDebug } from '../../util.js';
import { Cardinal } from '@modules/directions.js';
import { Pattern } from '@modules/pattern.js';
import { Regions } from '@modules/regions.js';
import { set } from './set.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'stack',
    description: 'commands.wedit:stack.description',
    usage: [
        {
            name: 'count',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }, {
            name: 'offset',
            type: 'Direction',
            default: new Cardinal()
        }
    ]
};

commandList['stack'] = [registerInformation, (session, builder, args) => {
    const amount = args.get('count');
    const [start, end] = session.getSelectionRange();
    const size = regionSize(start, end);
    
    const dir = args.get('offset').getDirection(builder).mul(size);
    let loadStart = start.offset(dir.x, dir.y, dir.z);
    let loadEnd = end.offset(dir.x, dir.y, dir.z);
    let count = 0;
    
    const history = session.getHistory();
    history.record();
    Regions.save('temp_stack', start, end, builder);
    for (let i = 0; i < amount; i++) {
        history.addUndoStructure(loadStart, loadEnd, 'any');
        Regions.load('temp_stack', loadStart, builder);
        history.addRedoStructure(loadStart, loadEnd, 'any');
        
        count += Regions.getBlockCount('temp_stack', builder);
        loadStart = loadStart.offset(dir.x, dir.y, dir.z);
        loadEnd = loadEnd.offset(dir.x, dir.y, dir.z);
    }
    Regions.delete('temp_stack', builder);
    history.commit();
    
    return `Set ${count} blocks successfully.`;
}];
