import './util.js';
import './commands/import-commands.js';
// TODO: Add far wand (Golden Axe)
// TODO: Add floodfill wand (Bucket?)

import { Player, world, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { Tools } from './tools/tool_manager.js';
import { print, printDebug } from './util.js';
import { PlayerUtil } from '@modules/player_util.js';
import { getSession, PlayerSession, removeSession } from './sessions.js';
import { RawText } from '@modules/rawtext.js';
import { DEBUG } from '@config.js';

Server.setMaxListeners(256);
let activeBuilders: Player[] = [];

let ready = false;
Server.on('ready', ev => {
    Server.runCommand(`gamerule showtags false`);
    Server.runCommand(`gamerule sendcommandfeedback ${DEBUG}`);
    printDebug(`World has been loaded in ${ev.loadTime} ticks!`);
    printDebug(isNaN(NaN));
    ready = true;
});

Server.on('playerJoin', ev => {
    printDebug(`player ${ev.player.name} joined.`);
    makeBuilder(ev.player);
});

Server.on('playerLeave', ev => {
    printDebug(`player ${ev.playerName} left.`);
    removeBuilder(ev.playerName);
});

Server.on('tick', ev => {
    if (!ready) return;

    for (const entity of world.getPlayers()) {
        const player = entity as Player;
        if (!activeBuilders.includes(player)) {
            if (PlayerUtil.isHotbarStashed(player)) {
                PlayerUtil.restoreHotbar(player);
            }
            if (!makeBuilder(player)) { // Attempt to make them a builder.
                print('worldedit.permission.granted', player);
                continue;
            }
            Tools.unbindAll(player);
        }
    }

    for (let i = activeBuilders.length - 1; i >= 0; i--) {
        try {
            let name = activeBuilders[i].name;
        } catch {
            printDebug('A builder no longer exists!');
            activeBuilders.splice(i, 1);
        }
        
        const builder = activeBuilders[i];
        let session: PlayerSession;
        if (hasWorldEdit(builder)) {
            session = getSession(builder);
        } else {
            removeBuilder(builder.name);
            Tools.unbindAll(builder);
            print('worldedit.permission.revoked', builder);
            continue;
        }
        
        if (builder.isSneaking) {
            //printDebug(PlayerUtil.isHotbarStashed(builder));
        }
    }
});

function makeBuilder(player: Player) {
    if (hasWorldEdit(player)) {
        getSession(player);
        activeBuilders.push(player);
        
        // remove any stray tags to prevent accidental item activation.
        for (const tag of player.getTags()) {
            if (tag.includes('wedit:')) {
                player.removeTag(tag);
            }
        }
        
        printDebug('Added player to world edit!');
        return false;
    }
    
    return true;
}

function removeBuilder(player: string) {
    let i = -1;
    do {
        i = activeBuilders.findIndex(p => {
            try {
                return p.name == player;
            } catch (e) {
                return true;
            }
        });
        if (i != -1) activeBuilders.splice(i, 1);
    } while (i != -1);
    
    removeSession(player);
    printDebug('Removed player from world edit!');
}

function hasWorldEdit(player: Player) {
    for (const tag of player.getTags()) {
        if (tag.startsWith('worldedit')) {
            return true;
        }
    }
    return false;
}