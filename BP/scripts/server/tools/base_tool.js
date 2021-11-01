import { Server } from '../../library/Minecraft.js';
import { playerHasItem, print, printerr } from '../util.js';
// Note: Tools that define both use and useOn require to activate the same tag with '_block' appended when used on a block.
export class Tool {
    log(message) {
        print(message, this.currentPlayer, true);
    }
    process(session, loc) {
        const player = session.getPlayer();
        if (loc === undefined && this.itemBase !== undefined) {
            if (playerHasItem(player, this.itemBase) && !playerHasItem(player, this.itemTool)) {
                this.replaceItemBase(player, player.getComponent('minecraft:inventory'));
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
    replaceItemBase(player, inv) {
        Server.runCommand(`clear "${player.nameTag}" ${this.itemBase}`);
        Server.runCommand(`give "${player.nameTag}" ${this.itemTool}`);
    }
}
