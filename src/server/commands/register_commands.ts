import { Server, Thread, Timer } from '@library/Minecraft.js';
import { getSession, hasSession, PlayerSession } from '../sessions.js';
import { print, printerr } from '../util.js';
import { error, log, warn } from '@library/utils/console.js';
import { RawText } from '@library/Minecraft.js';
import { registerInformation } from '@library/@types/build/classes/CommandBuilder.js';
import { Player } from 'mojang-minecraft';

let _printToActionBar = false;
type commandFunc = (s: PlayerSession, p: Player, args: Map<string, any>) => Generator<void, RawText | string> | RawText | string;

const commandList = new Map<string, [registerInformation, commandFunc]>();

export function registerCommand(registerInformation: registerInformation, callback: commandFunc) {
    commandList.set(registerInformation.name, [registerInformation, callback]);
    Server.command.register(registerInformation, (data, args) => {
        let toActionBar = _printToActionBar;
        _printToActionBar = false;
        const player = data.sender;
        if (!hasSession(player.name)) {
            data.cancel = false;
            return;
        }
        args.set('_using_item', getSession(player).usingItem);

        const thread = new Thread();
        thread.start(function* (msg, player, args) {
            const timer = new Timer();
            try {
                timer.start();
                log(`Processing command '${msg}' for '${player.name}'`);
                let result: string | RawText;
                if (callback.constructor.name == 'GeneratorFunction') {
                    result = yield* callback(getSession(player), player, args) as Generator<void, RawText | string>;
                } else {
                    result = callback(getSession(player), player, args) as string | RawText;
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

export function getCommandFunc(command: string) {
    return commandList.get(command)[1];
}

export function getCommandInfo(command: string) {
    return commandList.get(command)[0];
}

export function printToActionBar() {
    _printToActionBar = true;
}
