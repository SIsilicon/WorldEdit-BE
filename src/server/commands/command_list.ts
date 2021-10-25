import { BeforeChatEvent, Player } from 'mojang-minecraft';
import { registerInformation } from '../../library/@types/build/classes/CommandBuilder.js';
import { Server } from '../../library/Minecraft.js';
import { RawText } from '../modules/rawtext.js';
import { PlayerSession } from '../sessions.js';
import { printToActionBar } from './import-commands.js';

export type commandFunc = (s: PlayerSession, p: Player, args: string[]) => string | RawText | Promise<string | RawText>;

export interface extendedRegisterInformation extends registerInformation {
    usages?: string[]
}

export let commandList: {
    [k: string]: [
        extendedRegisterInformation,
        commandFunc
    ]
} = {};

export function callCommand(player: Player, command: string, args: string[] = []) {
    printToActionBar();
    Server.command.getRegistration(command).callback(<BeforeChatEvent> {sender: player}, args);
}