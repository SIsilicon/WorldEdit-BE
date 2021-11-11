import './util.js';
import './commands/import-commands.js';
// TODO: Add settings icon to Inventory UI (Include entities, etc...)
// TODO: Add far wand (Golden Axe)
// TODO: Add floodfill wand (Bucket?)

import { Player, World, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { Server } from '../library/Minecraft.js';
import { Tools } from './tools/tool_manager.js';
import { print, printDebug } from './util.js';
import { PlayerUtil } from './modules/player.js';
import { getSession, PlayerSession, removeSession } from './sessions.js';
import { assertBuilder } from './modules/assert.js';
import { RawText } from './modules/rawtext.js';
import { DEBUG } from '../config.js';

Server.setMaxListeners(256);

let justJoined: string[] = [];
let activeBuilders: Player[] = [];

let ready = false;
Server.on('ready', data => {
    Server.runCommand(`gamerule sendcommandfeedback ${DEBUG}`);
    printDebug(`World has been loaded in ${data.loadTime} ticks!`);
    ready = true;
});

Server.on('playerJoin', entity => {
    const player = World.getPlayers().find(p => {return p.nameTag == entity.nameTag});
    justJoined.push(player.nameTag);
    printDebug(`player ${player.nameTag} joined.`);
    // Can't make them a builder immediately since their tags aren't set up yet.
})

Server.on('playerLeave', player => {
    printDebug(`player ${player?.name} left.`);
    revokeBuilder(player.name);
})

Server.on('tick', ev => {
    if (!ready) return;

    for (const player of World.getPlayers()) {
        if (activeBuilders.includes(player)) {
            continue;
        }
        
        const playerJustJoined = justJoined.includes(player.nameTag);
        if (!playerJustJoined) {
            Tools.unbindAll(player);
        }
        
        if (!makeBuilder(player)) { // Attempt to make them a builder.
            print(RawText.translate('worldedit.permission.granted'), player);
        }
        
        if (playerJustJoined && !Server.runCommand(`testfor ${player.nameTag}`).error) {
            const i = justJoined.findIndex(p => { return p == player.nameTag });
            if (i != -1) {
                justJoined.splice(i, 1);
            }
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
        try {
            assertBuilder(builder);
            session = getSession(builder);
        } catch (e) {
            revokeBuilder(builder.nameTag);
            print(RawText.translate('worldedit.permission.revoked'), builder);
            continue;
        }
        
        if (!PlayerUtil.hasItem(builder, 'wedit:selection_wand')) {
            session.clearSelectionPoints();
        }
    }
});

function makeBuilder(player: Player) {
    try {
        assertBuilder(player);
        getSession(player);
        activeBuilders.push(player);
        for (const tag of Server.player.getTags(player.nameTag)) {
            if (tag.includes('wedit:')) {
                Server.runCommand(`tag "${player.nameTag}" remove ${tag}`);
            }
        }
        printDebug('Added player to world edit!');
        return false;
    } catch (e) {
        return true;
    };
}

function revokeBuilder(player: string) {
    let i = -1;
    do {
        i = activeBuilders.findIndex(p => {
            try {
                return p.nameTag == player;
            } catch (e) {
                return true;
            }
        });
        if (i != -1) activeBuilders.splice(i, 1);
    } while (i != -1);
    
    removeSession(player);
    printDebug('Removed player from world edit!');
}