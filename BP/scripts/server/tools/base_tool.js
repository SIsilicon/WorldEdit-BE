import { Server } from '../../library/Minecraft.js';
import { playerHasItem, playerReplaceItem, print, printerr } from '../util.js';
// Note: Tools that define both use and useOn require to activate the same tag with '_block' appended when used on a block.
export class Tool {
    log(message) {
        print(message, this.currentPlayer, true);
    }
    process(session, loc) {
        const player = session.getPlayer();
        if (loc === undefined && this.itemBase !== undefined) {
            if (playerHasItem(player, this.itemBase) && !playerHasItem(player, this.itemTool)) {
                this.bind(player);
            }
        }
        if (loc === undefined && this.use === undefined ||
            loc !== undefined && this.useOn === undefined) {
            return false;
        }
        const tag = loc !== undefined &&
            this.useOn != undefined &&
            this.use != undefined ? this.tag + '_block' : this.tag;
        if (!Server.runCommand(`tag "${player.nameTag}" remove ${tag}`).error) {
            this.currentPlayer = player;
            try {
                if (loc === undefined) {
                    this.use(player, session);
                }
                else {
                    this.useOn(player, session, loc);
                }
            }
            catch (e) {
                printerr(e, player, true);
            }
            this.currentPlayer = null;
            return true;
        }
        return false;
    }
    bind(player) {
        playerReplaceItem(player, this.itemBase, this.itemTool);
    }
    unbind(player) {
        if (playerHasItem(player, this.itemTool)) {
            if (this.itemBase) {
                playerReplaceItem(player, this.itemTool, this.itemBase);
            }
            else {
                Server.runCommand(`clear "${player.nameTag}" ${this.itemTool}`);
            }
        }
    }
}
