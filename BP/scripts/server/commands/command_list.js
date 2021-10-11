import { Server } from '../../library/Minecraft.js';
import { printToActionBar } from './import-commands.js';
export let commandList = {};
export function callCommand(player, command, args = []) {
    printToActionBar();
    Server.command.getRegistration(command).callback({ sender: player }, args);
}
