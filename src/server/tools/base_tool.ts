import { BlockLocation, Player } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Server } from '../../library/Minecraft.js';

import { RawText } from '../modules/rawtext.js';
import { print, printerr } from '../util.js';

// Note: Tools that define both use and useOn require to activate the same tag with '_block' appended when used on a block.
export abstract class Tool {
    static readonly emptyUse = (player: Player, session: PlayerSession) => {};
    static readonly emptyUseOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {};
    
    abstract readonly tag: string;
    abstract readonly use: (player: Player, session: PlayerSession) => void;
    abstract readonly useOn: (player: Player, session: PlayerSession, loc: BlockLocation) => void;
    
    private currentPlayer: Player;
    log(message: string | RawText) {
        print(message, this.currentPlayer, true);
    }
    
    process(session: PlayerSession, loc?: BlockLocation): boolean {
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
                } else {
                    this.useOn(player, session, loc);
                }
            } catch (e) {
                printerr(e, player, true);
            }
            this.currentPlayer = null;
            return true;
        }
        return false;
    }
}