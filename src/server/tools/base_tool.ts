import { BlockLocation, Player, TickEvent, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Server } from '@library/Minecraft.js';

import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { print, printerr, printDebug } from '../util.js';

/**
 * The base tool class for handling tools that WorldEdit builder may use.
 */
export abstract class Tool {
    /**
    * The function that's called when the tool is being used.
    */
    readonly use: (player: Player, session: PlayerSession) => void;
    /**
    * The function that's called when the tool is being used on a block.
    */
    readonly useOn: (player: Player, session: PlayerSession, loc: BlockLocation) => void;
    /**
     * The permission required for the tool to be used.
     */
    readonly permission: string;
    
    private currentPlayer: Player;
    log(message: string | RawText) {
        print(message, this.currentPlayer, true);
    }
    
    private useOnTick = 0;
    
    process(session: PlayerSession, tick: number, loc?: BlockLocation): boolean {
        const player = session.getPlayer();
        
        if (!loc && !this.use || loc && !this.useOn) {
            return false;
        }
        
        this.currentPlayer = player;
        try {
            if (!loc) {
                if (this.useOnTick != tick)
                    this.use(player, session);
            } else {
                this.useOnTick = tick;
                this.useOn(player, session, loc);
            }
        } catch (e) {
            const history = session.getHistory();
            if (history.isRecording()) {
                history.cancel();
            }
            printerr(e.message ? `${e.name}: ${e.message}` : e, player, true);
            if (e.stack) {
                printerr(e.stack, player, false);
            }
        }
        this.currentPlayer = null;
        return true;
    }
}