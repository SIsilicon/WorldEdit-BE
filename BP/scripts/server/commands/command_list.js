import { Server } from '../../library/Minecraft.js';
import { printToActionBar } from './import-commands.js';
export let commandList = {};
/**
 * Calls a WorldEdit command as a player.
 * @remark This function also causes commands to print to the action bar.
 * @param player The player the command will be called from
 * @param command The name of the command to call
 * @param args Arguments that the command may take
 */
export function callCommand(player, command, args = []) {
    printToActionBar();
    Server.command.getRegistration(command).callback({ sender: player }, args);
}
