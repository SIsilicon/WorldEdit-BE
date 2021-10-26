import './util.js';
import './commands/import-commands.js';
// // TODO: Add settings icon to Inventory UI (Include entities, etc...)
// // TODO: Implement masks
// // TODO: Add stacker wand (Iron Axe?)
// // TODO: Add floodfill wand (Bucket?)
// // TODO: Add brushes (Shovels?)
// // TODO: Add In-game How to play

import { BlockLocation, BlockProperties, MinecraftBlockTypes, Player, World } from 'mojang-minecraft';
import { Server } from '../library/Minecraft.js';
import { requestPlayerDirection, getPlayerBlockLocation, getPlayerDimension, playerHasItem, print, printDebug, printerr } from './util.js';
import { PLAYER_HEIGHT, DEBUG } from '../config.js';
import { dimension } from '../library/@types/index.js';
import { getSession, PlayerSession, removeSession } from './sessions.js';
import { assertBuilder } from './modules/assert.js';
import { callCommand } from './commands/command_list.js';
import { raytrace } from './modules/raytrace.js';
import { RawText } from './modules/rawtext.js';
import { generateSphere } from './commands/generation/sphere.js';
import { Pattern } from './modules/pattern.js';

Server.setMaxListeners(256);

let activeBuilders: Player[] = [];

let ready = false;
Server.on('ready', data => {
    Server.runCommand(`gamerule sendcommandfeedback ${DEBUG}`);
    printDebug(`World has been loaded in ${data.loadTime} ticks!`);
    ready = true;
});

Server.on('playerJoin', entity => {
    const player = World.getPlayers().find(p => {return p.nameTag == entity.nameTag});
    const onTick = () => {
        makeBuilder(player);
        Server.off('tick', onTick);
    }
    Server.prependOnceListener('tick', onTick);
})

Server.on('playerLeave', player => {
    if (player.name) {
        revokeBuilder(player.name);
    }
})

Server.on('tick', ev => {
    if (!ready)
      return;
    
    for (const player of World.getPlayers()) {
        if (activeBuilders.includes(player)) {
            continue;
        }
        
        if (!makeBuilder(player)) { // Attempt to make them a builder.
            print(RawText.translate('worldedit.permission.granted'), player);
        }
    }

    for (const builder of activeBuilders) {
        let session: PlayerSession;
        try {
            assertBuilder(builder);
            session = getSession(builder);
        } catch (e) {
            revokeBuilder(builder.nameTag);
            print(RawText.translate('worldedit.permission.revoked'), builder);
            continue;
        }
        
        if (playerHasItem(builder, 'wooden_axe') && !playerHasItem(builder, 'wedit:selection_wand')) {
            Server.runCommand(`clear ${builder.nameTag} wooden_axe`);
            giveWorldEditKit(builder);
        }
        if (playerHasItem(builder, 'compass') && !playerHasItem(builder, 'wedit:navigation_wand')) {
            Server.runCommand(`clear ${builder.nameTag} compass`);
            Server.runCommand(`give ${builder.nameTag} wedit:navigation_wand`);
        }
        if (!playerHasItem(builder, 'wedit:selection_wand')) {
            session.clearSelectionPoints();
        }
        
        // TODO: Move brush operations somewhere else
        /*processTag('wedit:use_wooden_brush', builder, player => {
            const [dimension, dimName] = getPlayerDimension(player);
            const origin = player.location;
            origin.y += PLAYER_HEIGHT;
            return requestPlayerDirection(player).then(dir => {
                const hit = raytrace(dimension, origin, dir);
                if (!hit) {
                    printerr(RawText.translate('worldedit.jumpto.none'), player);
                }
                try {
                    generateSphere(session, hit, [4, 4, 4], Pattern.parseArg('stone'), false);
                } catch (e) {
                    printerr(e, player);
                }
            });
        });*/
    }
});

function makeBuilder(player: Player) {
    try {
        assertBuilder(player);
        getSession(player);
        activeBuilders.push(player);
        for (const tag of Server.player.getTags(player.nameTag)) {
            if (tag.includes('wedit:')) {
                Server.runCommand(`tag ${player.nameTag} remove ${tag}`);
            }
        }
        printDebug('Added player to world edit!');
        return false;
    } catch (e) {
        return true;
    };
}

function revokeBuilder(player: string) {
    activeBuilders.splice(activeBuilders.findIndex(p => {return p.nameTag == player}), 1);
    removeSession(player);
    printDebug('Removed player from world edit!');
}

function giveWorldEditKit(player: Player) {
    function giveItem(item: string) {
        if (Server.runCommand(`clear ${player.nameTag} ${item} 0 0`).error) {
            Server.runCommand(`give ${player.nameTag} ${item}`);
        }
    }

    giveItem('wedit:selection_wand');
    giveItem('wedit:selection_fill');
    giveItem('wedit:pattern_picker');
    giveItem('wedit:copy_button');
    giveItem('wedit:cut_button');
    giveItem('wedit:paste_button');
    giveItem('wedit:undo_button');
    giveItem('wedit:redo_button');
    giveItem('wedit:spawn_glass');
}
