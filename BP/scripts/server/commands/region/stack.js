import { assertValidInteger } from '../../modules/assert.js';
import { regionSize } from '../../util.js';
import { getDirection } from '../../modules/directions.js';
import { Regions } from '../../modules/regions.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'stack',
    description: 'Repeat the contents of the current selection',
    usage: '[count: int] [offset: Direction]',
    example: [
        'stack 5',
        'stack 10 up'
    ]
};
commandList['stack'] = [registerInformation, (session, builder, args) => {
        const amount = args[0] ? parseInt(args[0]) : 1;
        assertValidInteger(amount, args[0]);
        const direction = (args[1] ?? 'me').toLowerCase();
        const [start, end] = session.getSelectionRange();
        const size = regionSize(start, end);
        return getDirection(direction, builder).then(dir => {
            let direction = [
                dir[0] * size.x,
                dir[1] * size.y,
                dir[2] * size.z
            ];
            let loadStart = start.offset(...direction);
            let loadEnd = end.offset(...direction);
            let count = 0;
            const history = session.getHistory();
            history.record();
            Regions.save('temp_stack', start, end, builder);
            for (let i = 0; i < amount; i++) {
                history.addUndoStructure(loadStart, loadEnd, 'any');
                Regions.load('temp_stack', loadStart, builder, 'absolute');
                history.addRedoStructure(loadStart, loadEnd, 'any');
                count += Regions.getBlockCount('temp_stack', builder);
                loadStart = loadStart.offset(...direction);
                loadEnd = loadEnd.offset(...direction);
            }
            Regions.delete('temp_stack', builder);
            history.commit();
            return `Set ${count} blocks successfully.`;
        });
    }];
