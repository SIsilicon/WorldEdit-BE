import { Server } from '../../library/Minecraft.js';
import { print, printerr } from '../util.js';
// Note: Tools that define both use and useOn require to activate the same tag with '_block' appended when used on a block.
export class Tool {
    log(message) {
        print(message, this.currentPlayer, true);
    }
    process(session, loc) {
        if (loc === undefined && this.use == Tool.emptyUse ||
            loc !== undefined && this.useOn == Tool.emptyUseOn) {
            return false;
        }
        const player = session.getPlayer();
        const tag = loc !== undefined &&
            this.useOn != Tool.emptyUseOn &&
            this.use != Tool.emptyUse ? this.tag + '_block' : this.tag;
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
}
Tool.emptyUse = (player, session) => { };
Tool.emptyUseOn = (player, session, loc) => { };
