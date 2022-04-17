import { Server, Thread, Timer } from '@library/Minecraft.js';
import { commandList } from './command_list.js';
import { getSession, hasSession } from '../sessions.js';
import { print, printerr } from '../util.js';
import { error, log, warn } from '@library/utils/console.js';
import { RawText } from '@modules/rawtext.js';
import { Cardinal } from '@modules/directions.js';
import { Expression } from '@modules/expression.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { COMMAND_PREFIX } from '@config.js';

Server.command.addCustomArgType('Mask', Mask);
Server.command.addCustomArgType('Pattern', Pattern);
Server.command.addCustomArgType('Direction', Cardinal);
Server.command.addCustomArgType('Expression', Expression);

import './misc/help.js';
import './misc/worldedit.js';
import './misc/limit.js';
import './misc/kit.js';

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
import './generation/gen.js';

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
        
        const thread = new Thread();
        thread.start(function* (msg, player, args) {
            const timer = new Timer();
            try {
                timer.start();
                log(`Processing command '${msg}' for '${player.name}'`);
                let result: string | RawText;
                if (command[1].constructor.name == 'GeneratorFunction') {
                    result = yield* command[1](getSession(player), player, args) as Generator<void, RawText | string>;
                } else {
                    result = command[1](getSession(player), player, args) as string | RawText;
                }
                const time = timer.end();
                log(`Time taken to execute: ${time}ms (${time / 1000.0} secs)`);
                print(result, player, toActionBar);
            }
            catch (e) {
                const errMsg = e.message ? `${e.name}: ${e.message}` : e;
                error(`Command '${msg}' failed for '${player.name}' with msg: ${errMsg}`);
                printerr(errMsg, player, toActionBar);
                if (e.stack) {
                    printerr(e.stack, player, false);
                }
            }
        }, data.message, data.sender, args);

        return thread;
    });
}

export function printToActionBar() {
    _printToActionBar = true;
}
