import { RawText } from '@modules/rawtext.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'undo',
    permission: 'worldedit.history.undo',
    description: 'commands.wedit:undo.description',
    usage: [
        {
            name: 'times',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }
    ]
};

// TODO: Support async
commandList['undo'] = [registerInformation, (session, builder, args) => {
    const times = args.get('times') as number;
    const history = session.getHistory();
    for(var i = 0; i < times; i++) {
        if (history.undo(session)) {
            break;
        }
    }
    return RawText.translate(i == 0 ? 'commands.wedit:undo.none' : 'commands.wedit:undo.explain').with(`${i}`);
}];
