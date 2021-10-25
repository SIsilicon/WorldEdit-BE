import { Player } from 'mojang-minecraft';
import { Server } from '../../../library/Minecraft.js';
import { assertBuilder } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';

import { getSession } from '../../sessions.js';
import { regionMin, regionMax } from '../../util.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    cancelMessage: true,
    name: 'redo',
    description: 'Redo a certain amount of actions.',
    usage: '[times: int]',
};

commandList['redo'] = [registerInformation, (session, builder, args) => {
    const times = parseInt(args[0] || '1');
    if (isNaN(times)) throw 'The times parameter is an invalid integer!';
    if (times <= 0) throw 'Only positive non-integer numbers are allowed!';

    const history = session.getHistory();
    for(var i = 0; i < times; i++) {
        if (history.redo()) {
            break;
        }
    }
    
    return RawText.translate(i == 0 ? 'worldedit.redo.none' : 'worldedit.redo.redone').with(`${i}`);
}];
