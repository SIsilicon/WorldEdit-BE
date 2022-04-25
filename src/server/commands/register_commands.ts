import { CommandInfo, Server, Thread, Timer, RawText, contentLog } from '@notbeer-api';
import { getSession, hasSession, PlayerSession } from '../sessions.js';
import { print, printerr } from '../util.js';
import { BeforeChatEvent, Player } from 'mojang-minecraft';

type commandFunc = (s: PlayerSession, p: Player, args: Map<string, any>) => Generator<void, RawText | string> | RawText | string;

const commandList = new Map<string, [CommandInfo, commandFunc]>();

export function registerCommand(registerInformation: CommandInfo, callback: commandFunc) {
    commandList.set(registerInformation.name, [registerInformation, callback]);
    Server.command.register(registerInformation, (data: BeforeChatEvent, args: Map<string, any>) => {
        const player = data.sender;
        if (!hasSession(player.name)) {
            data.cancel = false;
            return;
        }
        let toActionBar = getSession(player).usingItem;
        args.set('_using_item', getSession(player).usingItem);

        const thread = new Thread();
        thread.start(function* (msg, player, args) {
            const timer = new Timer();
            try {
                timer.start();
                contentLog.log(`Processing command '${msg}' for '${player.name}'`);
                let result: string | RawText;
                if (callback.constructor.name == 'GeneratorFunction') {
                    result = yield* callback(getSession(player), player, args) as Generator<void, RawText | string>;
                } else {
                    result = callback(getSession(player), player, args) as string | RawText;
                }
                const time = timer.end();
                contentLog.log(`Time taken to execute: ${time}ms (${time / 1000.0} secs)`);
                print(result, player, toActionBar);
            }
            catch (e) {
                const errMsg = e.message ? `${e.name}: ${e.message}` : e;
                contentLog.error(`Command '${msg}' failed for '${player.name}' with msg: ${errMsg}`);
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
