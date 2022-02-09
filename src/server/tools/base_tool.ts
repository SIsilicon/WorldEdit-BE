import { BlockLocation, Player, TickEvent, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { Server } from '@library/Minecraft.js';

import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';
import { print, printerr, printDebug } from '../util.js';

/**
 * The base tool class for handling tools that WorldEdit builder may use.
 * @remark Tools that define both {Tool.use} and {Tool.useOn} require to activate the same tag with '_block' appended when used on a block.
 */
export abstract class Tool {
    /**
    * The entity tag this tool gives players on activation.
    */
    abstract readonly tag: string;
    
    /**
    * The item this tool is associated with
    */
    abstract readonly itemTool: string;
    
    /**
    * The function that's called when the tool is being used.
    */
    readonly use: (player: Player, session: PlayerSession) => void;
    
    /**
    * The function that's called when the tool is being used on a block.
    */
    readonly useOn: (player: Player, session: PlayerSession, loc: BlockLocation) => void;
    
    /**
    * The item this tool may originate from.
    * @example The selection wand is derived from the wooden axe.
    */
    readonly itemBase: string;
    
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
        const hasPerms = Server.player.hasPermission(player, this.permission);
        if (!loc) {
            if (hasPerms) {
                this.bind(player);
            } else {
                this.unbind(player);
            }
        }
        
        if (!loc && !this.use || loc && !this.useOn) {
            return false;
        }
        const tag = (loc && this.useOn && this.use) ? this.tag + '_block' : this.tag;
        
        if (player.hasTag(tag)) {
            player.removeTag(tag);
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
                printerr(e, player, true);
                if (e.stack) {
                    printerr(e.stack, player, false);
                }
            }
            this.currentPlayer = null;
            return true;
        }
        return false;
    }
    
    bind(player: Player) {
        if (PlayerUtil.hasItem(player, this.itemBase)) {
            PlayerUtil.replaceItem(player, this.itemBase, this.itemTool);
        }
    }
    
    unbind(player: Player) {
        if (PlayerUtil.hasItem(player, this.itemTool)) {
            if (this.itemBase) {
                PlayerUtil.replaceItem(player, this.itemTool, this.itemBase);
            } else {
                Server.runCommand(`clear @s ${this.itemTool} 0 1`, player);
            }
        }
    }
}