import './util.js';
import './commands/import-commands.js';
// // TODO: Add settings icon to Inventory UI (Include entities, etc...)
// // TODO: Implement masks
// // TODO: Add stacker wand (Iron Axe?)
// // TODO: Add floodfill wand (Bucket?)
// // TODO: Add brushes (Shovels?)
// // TODO: Add In-game How to play
import { BlockLocation, BlockProperties, MinecraftBlockTypes, World } from 'mojang-minecraft';
import { Server } from '../library/Minecraft.js';
import { getPlayerBlockLocation, getPlayerDimension, playerHasItem, print, printDebug, printerr } from './util.js';
import { getSession, removeSession } from './sessions.js';
import { assertBuilder } from './modules/assert.js';
import { callCommand } from './commands/command_list.js';
import { RawText } from './modules/rawtext.js';
// These markers are used to detect a player doing something with tools, items or brushes.
const buildTagMarkers = [
    'wedit:making_selection',
    'wedit:picking_block_pattern',
    'wedit:performing_copy',
    'wedit:performing_cut',
    'wedit:performing_paste',
    'wedit:performing_undo',
    'wedit:performing_redo',
    'wedit:performing_spawn_glass',
    'wedit:navigating',
    'wedit:performing_selection_fill',
];
let activeBuilders = [];
function processTag(tag, player, callback) {
    if (!Server.runCommand(`tag ${player.nameTag} remove ${tag}`).error) {
        callback(player);
        return true;
    }
    return false;
}
Server.on('ready', data => {
    Server.runCommand('gamerule sendcommandfeedback false');
    printDebug(`World has been loaded in ${data.loadTime} ticks!`);
});
Server.on('playerJoin', entity => {
    const player = World.getPlayers().find(p => { return p.nameTag == entity.nameTag; });
    makeBuilder(player);
});
Server.on('playerLeave', player => {
    revokeBuilder(player.name);
});
Server.on('entityCreate', entity => {
    if (entity.id == 'wedit:block_marker' ||
        entity.id == 'unknown' && entity.getComponent('minecraft:health')?.value == 41902) {
        const loc = new BlockLocation(Math.floor(entity.location.x), Math.floor(entity.location.y), Math.floor(entity.location.z));
        let dimension;
        for (const player of World.getPlayers()) {
            let processed = false;
            processed || (processed = processTag('wedit:making_selection', player, player => {
                callCommand(player, player.isSneaking ? 'pos1' : 'pos2', [`${loc.x}`, `${loc.y}`, `${loc.z}`]);
            }));
            processed || (processed = processTag('wedit:picking_block_pattern', player, player => {
                try {
                    assertBuilder(player);
                    dimension = getPlayerDimension(player)[1];
                    let addedToPattern = false;
                    let block = World.getDimension(dimension).getBlock(loc).getBlockData().clone();
                    let blockName = block.getType().getName();
                    const session = getSession(player);
                    if (player.isSneaking) {
                        let isCauldron = false;
                        if (blockName == 'minecraft:cauldron' || blockName == 'minecraft:lava_cauldron') {
                            isCauldron = true;
                            session.clearPickerPattern();
                            if (blockName == 'minecraft:lava_cauldron') {
                                block = MinecraftBlockTypes.lava.createDefaultBlockPermutation();
                                blockName = 'minecraft:flowing_lava';
                            }
                            else if (block.getProperty(BlockProperties.fillLevel).value) {
                                block = MinecraftBlockTypes.water.createDefaultBlockPermutation();
                                blockName = 'minecraft:water';
                            }
                            else {
                                block = MinecraftBlockTypes.air.createDefaultBlockPermutation();
                                blockName = 'minecraft:air';
                            }
                        }
                        session.addPickerPattern(block);
                        addedToPattern = !isCauldron;
                    }
                    else {
                        session.clearPickerPattern();
                        session.addPickerPattern(block);
                    }
                    // TODO: Properly name fences, shulker boxes, polished stones, slabs, glazed terracotta, sand
                    for (const prop of block.getAllProperties()) {
                        if (typeof prop.value == 'string') {
                            blockName += '.' + prop.value;
                        }
                    }
                    if (blockName.startsWith('minecraft:')) {
                        blockName = blockName.slice('minecraft:'.length);
                    }
                    print(RawText.translate('worldedit.pattern-picker.' + (addedToPattern ? 'add' : 'set'))
                        .append('translate', `tile.${blockName}.name`), player, true);
                }
                catch (e) {
                    printerr(e, player, true);
                }
            }));
            if (processed) {
                if (!dimension)
                    dimension = getPlayerDimension(player)[1];
                break;
            }
        }
        entity.nameTag = 'wedit:pending_deletion_of_selector';
        if (dimension) {
            Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
            Server.runCommand(`kill @e[name=${entity.nameTag}]`, dimension);
        }
    }
});
Server.on('tick', ev => {
    for (const player of World.getPlayers()) {
        if (activeBuilders.includes(player)) {
            continue;
        }
        makeBuilder(player); // Attempt to make them a builder.
    }
    for (const builder of activeBuilders) {
        let session;
        try {
            assertBuilder(builder);
            session = getSession(builder);
        }
        catch (e) {
            revokeBuilder(builder.nameTag);
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
        processTag('wedit:performing_copy', builder, player => {
            callCommand(player, 'copy', []);
        });
        processTag('wedit:performing_cut', builder, player => {
            callCommand(player, 'cut', []);
        });
        processTag('wedit:performing_paste', builder, player => {
            callCommand(player, 'paste', []);
        });
        processTag('wedit:performing_undo', builder, player => {
            callCommand(player, 'undo', []);
        });
        processTag('wedit:performing_redo', builder, player => {
            callCommand(player, 'redo', []);
        });
        processTag('wedit:performing_spawn_glass', builder, player => {
            if (Server.runCommand(`execute ${player.nameTag} ~~~ setblock ~~~ glass`).error) {
                printerr(RawText.translate('worldedit.spawn-glass.error'), player, true);
            }
        });
        processTag('wedit:performing_selection_fill', builder, player => {
            const session = getSession(player);
            session.usePickerPattern = true;
            callCommand(player, 'set', []);
            session.usePickerPattern = false;
        });
        processTag('wedit:navigating', builder, player => {
            const dimension = getPlayerDimension(player)[0];
            if (!dimension.isEmpty(getPlayerBlockLocation(player).offset(0, 1, 0))) {
                callCommand(player, 'unstuck', []);
            }
            else if (player.isSneaking) {
                callCommand(player, 'thru', []);
            }
            else {
                callCommand(player, 'jumpto', []);
            }
        });
    }
});
function makeBuilder(player) {
    try {
        assertBuilder(player);
        getSession(player);
        activeBuilders.push(player);
        for (const tag of buildTagMarkers) {
            Server.runCommand(`tag ${player.nameTag} remove ${tag}`);
        }
        printDebug('Added player to world edit!');
        return false;
    }
    catch (e) {
        return true;
    }
    ;
}
function revokeBuilder(player) {
    activeBuilders.splice(activeBuilders.findIndex(p => { return p.nameTag == player; }), 1);
    removeSession(player);
    printDebug('Removed player from world edit!');
}
function giveWorldEditKit(player) {
    function giveItem(item) {
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
