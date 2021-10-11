import { RawText } from '../../modules/rawtext.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'undo',
    description: 'Undo a certain amount of actions.',
    usage: '[times]',
};
commandList['undo'] = [registerInformation, (session, builder, args) => {
        const times = parseInt(args[0] || '1');
        if (isNaN(times))
            throw 'The times parameter is an invalid integer!';
        if (times <= 0)
            throw 'Only positive non-integer numbers are allowed!';
        const history = session.getHistory();
        for (var i = 0; i < times; i++) {
            if (history.undo()) {
                break;
            }
        }
        return RawText.translate(i == 0 ? 'worldedit.undo.none' : 'worldedit.undo.undone').with(`${i}`);
    }];
