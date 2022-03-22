import { Server } from '@library/Minecraft.js';
import { registerInformation } from '@library/@types/build/classes/CommandBuilder.js';
import { commandList, commandFunc } from './command_list.js';
import { getSession, hasSession } from '../sessions.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { Cardinal } from '@modules/directions.js';
import { Player } from 'mojang-minecraft';
import { print, printerr, printDebug } from '../util.js';
import { COMMAND_PREFIX } from '@config.js';

Server.command.addCustomArgType('Mask', Mask);
Server.command.addCustomArgType('Pattern', Pattern);
Server.command.addCustomArgType('Direction', Cardinal);

import './misc/help.js';
import './misc/kit.js';
import './misc/worldedit.js';
import './misc/limit.js';

import './selection/pos1.js';
import './selection/pos2.js';
import './selection/hpos1.js';
import './selection/hpos2.js';
import './selection/drawsel.js';
import './selection/desel.js';
import './selection/wand.js';
import './selection/contract.js';
import './selection/expand.js';
import './selection/shift.js';
import './selection/outset.js';
import './selection/inset.js';

import './clipboard/cut.js';
import './clipboard/copy.js';
import './clipboard/paste.js';
import './clipboard/clearclipboard.js';

import './generation/hsphere.js';
import './generation/sphere.js';
import './generation/cyl.js';
import './generation/hcyl.js';
import './generation/pyramid.js';
import './generation/hpyramid.js';

import './region/gmask.js';
import './region/set.js';
import './region/replace.js';
import './region/move.js';
import './region/stack.js';
import './region/rotate.js';
import './region/flip.js';
import './region/wall.js';
import './region/smooth.js';
import './region/faces.js';
// TODO: Implement hollow
import './region/line.js';

import './navigation/navwand.js';
import './navigation/up.js';
import './navigation/unstuck.js';
import './navigation/jumpto.js';
import './navigation/thru.js';
// TODO: Implement ascend and descend
// TODO: Implement ceil

import './tool/tool.js';

import './brush/brush.js';
import './brush/mask.js';
import './brush/tracemask.js';
import './brush/size.js';
import './brush/range.js';
import './brush/material.js';

import './history/undo.js';
import './history/redo.js';
import './history/clearhistory.js';

Server.command.prefix = COMMAND_PREFIX;
let _printToActionBar = false;

for (const name in commandList) {
    const command = commandList[name];
    Server.command.register(command[0], (data, args) => {
        let toActionBar = _printToActionBar;
        _printToActionBar = false;
        const player = data.sender;
        if (!hasSession(player.name)) {
            data.cancel = false;
            return;
        }
        
        try {
            const start = new Date().getTime();
            const msg = command[1](getSession(player), player, args);
            printDebug(`Time taken to execute: ${new Date().getTime() - start}ms`);
            print(msg, player, toActionBar);
        } catch (e) {
            const history = getSession(data.sender).getHistory();
            if (history.isRecording()) {
                history.cancel();
            }
            printerr(e.message ? `${e.name}: ${e.message}` : e, data.sender, toActionBar);
            if (e.stack) {
                printerr(e.stack, data.sender, false);
            }
        }
    });
}

export function printToActionBar() {
    _printToActionBar = true;
}
