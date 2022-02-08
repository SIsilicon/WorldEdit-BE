import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'redo',
    permission: 'worldedit.history.redo',
    description: 'commands.wedit:redo.description',
    usage: [
        {
            name: 'times',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }
    ]
};

commandList['redo'] = [registerInformation, (session, builder, args) => {
    const times = args.get('times') as number;
    const history = session.getHistory();
    for(var i = 0; i < times; i++) {
        if (history.redo(session)) {
            break;
        }
    }
    return RawText.translate(i == 0 ? 'commands.wedit:redo.none' : 'commands.wedit:redo.explain').with(`${i}`);
}];
