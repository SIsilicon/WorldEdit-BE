import { Server } from '../../library/Minecraft.js';
import { registerInformation } from '../../library/@types/build/classes/CommandBuilder.js';
import { commandList, commandFunc } from './command_list.js';
import { assertBuilder } from '../modules/assert.js';
import { getSession } from '../sessions.js';
import { Player } from 'mojang-minecraft';
import { print, printerr } from '../util.js';

// TODO: Localization of all strings
// TODO: Throw proper syntax errors (command.generic.syntax = Syntax error: Unexpected "%2$s": at "%1$s>>%2$s<<%3$s")

import './information/help.js';

import './selection/pos1.js';
import './selection/pos2.js';
import './selection/drawsel.js';
import './selection/desel.js';
import './selection/wand.js';

import './clipboard/cut.js';
import './clipboard/copy.js';
import './clipboard/paste.js';

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
// TODO: Implement wall
// TODO: Implement faces
// TODO: Implement hollow
// TODO: Implement line

import './navigation/navwand.js';
import './navigation/up.js';
import './navigation/unstuck.js';
import './navigation/jumpto.js';
import './navigation/thru.js';
// TODO: Implement ascend and descend
// TODO: Implement ceil

import './tool/tools.js';
import './brush/brushes.js';

import './history/undo.js';
import './history/redo.js';
import './history/clearhistory.js';

Server.command.prefix = ';';
let _printToActionBar = false;

for (const name in commandList) {
	const command = commandList[name];
	
	if (command[0].usages) {
		for (const usage of command[0].usages) {
			const subCmd = {
				name: command[0].name,
				aliases: command[0].aliases,
				description: command[0].description,
				usage: usage
			}
			
			registerCommand(subCmd, command[1]);
		}
	} else {
		registerCommand(command[0], command[1]);
	}
}

function registerCommand(cmd: registerInformation, callback: commandFunc) {
	Server.command.register(cmd, (data, args) => {
		let toActionBar = _printToActionBar;
		_printToActionBar = false;
		try {
			const player = data.sender;
			assertBuilder(player);
			const msg = callback(getSession(player), player, args);
			if (msg instanceof Promise) {
				msg.then(msg => {
					print(msg, player, toActionBar);
				}).catch(err => {
					printerr(err, player, toActionBar);
				})
			} else {
				print(msg, player, toActionBar);
			}
		} catch (e) {
			printerr(e, data.sender, toActionBar);
		}
	});
}

export function printToActionBar() {
	_printToActionBar = true;
}
