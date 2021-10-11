import { BeforeChatEvent, Player } from 'mojang-minecraft';
import { registerInformation } from '../../library/@types/build/classes/CommandBuilder';
import { Server } from '../../library/Minecraft.js';
import { RawText } from '../modules/rawtext.js';
import { getSession, PlayerSession } from '../sessions.js';
import { printToActionBar } from './import-commands.js';

export let commandList: {
    [k: string]: [
        registerInformation,
        (s: PlayerSession, p: Player, args: string[]) => string | RawText | Promise<string | RawText>
    ]
} = {};

export function callCommand(player: Player, command: string, args: string[] = []) {
    printToActionBar();
    Server.command.getRegistration(command).callback(<BeforeChatEvent> {sender: player}, args);
}