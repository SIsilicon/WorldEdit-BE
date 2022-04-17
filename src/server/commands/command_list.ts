import { BeforeChatEvent, Player } from 'mojang-minecraft';
import { registerInformation } from '@library/@types/build/classes/CommandBuilder.js';
import { Server } from '@library/Minecraft.js';
import { PlayerSession } from '../sessions.js';
import { printToActionBar } from './register_commands.js';
import { assertPermission } from '@modules/assert.js';
import { RawText } from '@modules/rawtext.js';

export type commandFunc = (s: PlayerSession, p: Player, args: Map<string, any>) => Generator<void, RawText | string> | RawText | string;

export let commandList: {
    [k: string]: [
        registerInformation,
        commandFunc
    ]
} = {};

/**
 * Calls a WorldEdit command as a player.
 * @remark This function also causes commands to print to the action bar.
 * @param player The player the command will be called from
 * @param command The name of the command to call
 * @param args Arguments that the command may take
 */
export function callCommand(player: Player, command: string, args: string[] = []) {
    const registration = Server.command.getRegistration(command);
    assertPermission(player, registration.permission);
    printToActionBar();
    return registration.callback(<BeforeChatEvent> {
        cancel: true,
        sender: player,
        message: `;${command} ${args.join(' ')}`
    }, Server.command.parseArgs(command, args));
}