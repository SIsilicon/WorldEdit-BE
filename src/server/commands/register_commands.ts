import { CommandInfo, Server, Thread, Timer, RawText, contentLog } from "@notbeer-api";
import { getDebugSessions, getSession, hasSession, PlayerSession } from "../sessions.js";
import { print, printerr } from "../util.js";
import { Player, system } from "@minecraft/server";
import { UnloadedChunksError } from "@modules/assert.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type commandFunc = (s: PlayerSession, p: Player, args: Map<string, any>) => Generator<unknown, RawText | string> | RawText | string;

const commandList = new Map<string, [CommandInfo, commandFunc]>();

function debugLog(sessions: PlayerSession[], message: string) {
    for (const session of sessions) {
        print(RawText.text(`§8[Debug] §7${message}`), session.player, false);
    }
}

Server.command.on("commandError", (player, command, args, error) => {
    const commandText = `${Server.command.prefix}${command}${args.length ? ` ${args.join(" ")}` : ""}`;
    const playerName = player.name;

    system.run(() => {
        for (const session of getDebugSessions()) {
            if (session.player.id === player.id) continue;

            print(RawText.text(`§8[Debug] §cCommand error from '${playerName}': ${commandText}`), session.player, false);

            printerr(error, session.player, false);
        }
    });
});

const sawOutsideWorldErr: Player[] = [];

export function registerCommand(registerInformation: CommandInfo, callback: commandFunc) {
    commandList.set(registerInformation.name, [registerInformation, callback]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Server.command.register(registerInformation, (player: Player, msg: string, args: Map<string, any>) => {
        if (!hasSession(player.id)) return undefined;
        const toActionBar = getSession(player).usingItem;
        args.set("_using_item", getSession(player).usingItem);

        const thread = new Thread();
        thread.start(
            function* (msg, player, args) {
                const session = getSession(player);
                const debugSessions = getDebugSessions();
                const timer = new Timer();

                try {
                    timer.start();

                    const processingMessage = `Processing command '${msg}' for '${player.name}'`;
                    contentLog.log(processingMessage);
                    debugLog(debugSessions, processingMessage);

                    let result: string | RawText;

                    if (callback.constructor.name == "GeneratorFunction") {
                        result = yield* callback(session, player, args) as Generator<void, RawText | string>;
                    } else {
                        result = callback(session, player, args) as string | RawText;
                    }
                    const time = timer.end();
                    const timeMessage = `Time taken to execute: ${time}ms (${time / 1000.0} secs)`;
                    contentLog.log(timeMessage);

                    debugLog(debugSessions, timeMessage);
                    if (result) print(result, player, toActionBar);
                } catch (e) {
                    const errMsg = e.message ? RawText.text(`${e.name}: `).append("translate", e.message) : e;
                    contentLog.error(`Command '${msg}' failed for '${player.name}' with msg: ${errMsg}`);
                    printerr(errMsg, player, toActionBar);

                    if (e instanceof UnloadedChunksError) {
                        if (!sawOutsideWorldErr.includes(player)) {
                            sawOutsideWorldErr.push(player);
                            print("commands.generic.wedit:outsideWorld.detail", player, false);
                        }
                    } else if (e.stack) {
                        printerr(e.stack, player, false);
                    }
                }
            },
            msg,
            player,
            args
        );

        return thread;
    });
}

export function getCommandFunc(command: string) {
    return commandList.get(command)[1];
}

export function getCommandInfo(command: string) {
    return commandList.get(command)[0];
}
