import { Player, Dimension, World, Entity, Location, BlockLocation, InventoryComponentContainer } from 'mojang-minecraft';
import { dimension } from '@library/@types/index.js';
import { Server } from '@library/Minecraft.js';
import { EventEmitter } from '@library/build/classes/eventEmitter.js';
import { Vector } from './vector.js';
import { printDebug } from '../util.js';

/**
 * This singleton holds utility functions for players.
 */
class PlayerHandler extends EventEmitter {
    private playerDimensions = new Map<string, [boolean, Dimension, dimension]>();
    
    constructor() {
        super();
        Server.on('tick', tick => {
            for (const entry of this.playerDimensions) {
                entry[1][0] = false;
            }
            
            for (const player of World.getPlayers()) {
                const oldDimension = this.playerDimensions.get(player.nameTag)?.[2];
                const newDimension = this.getDimension(player)[1];
                
                if (oldDimension && oldDimension != newDimension) {
                    this.emit('playerChangeDimension', player, newDimension);
                }
            }
        });
        this.on('playerChangeDimension', (player, dimension) => {
            // Teleport the inventory stasher with the player
            printDebug(`"${player.nameTag}" has travelled to "${dimension}"`);
            const stasherName = 'wedit:stasher_for_' + player.nameTag;
            Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name="${stasherName}"] ~ 512 ~`, dimension);
        });
    }
    
    /**
    * Tells you whether the player has an item.
    * @param player The player being tested
    * @param item The item being tested for
    * @return True if the player has the item; false otherwise
    */
    hasItem(player: Player, item: string) {
        return !Server.runCommand(`clear "${player.nameTag}" ${item} 0 0`).error;
    }
    
    /**
    * Replaces an item stack in the player's inventory with another item.
    * @remark This does not check the player's armor slots nor offhand.
    * @param player The player being affected
    * @param item The item being replaced
    * @param sub The new item being replaced with
    */
    replaceItem(player: Player, item: string, sub: string) {
        const inv = player.getComponent('inventory').container;
        for (let i = 0; i < inv.size; i++) {
            if (inv.getItem(i)?.id === item) {
                const slotType = i > 8 ? 'slot.inventory' : 'slot.hotbar';
                const slotId = i > 8 ? i - 9 : i;
                // printDebug(slotId);
                // printDebug(slotType);
                // printDebug(item + ' -> ' + sub);
                Server.runCommand(`replaceitem entity "${player.nameTag}" ${slotType} ${slotId} ${sub}`);
                break;
            }
        }
    }
    
    /**
    * Gives the player's location in the form of {mojang-minecraft.BlockLocation}.
    * @param player The player being queried
    * @return The block location of the player
    */
    getBlockLocation(player: Player) {
        return new BlockLocation(
            Math.floor(player.location.x),
            Math.floor(player.location.y),
            Math.floor(player.location.z)
        );
    }
    
    /**
    * Gives the direction the player is looking in.
    * @param player the player being queried
    * @return The direction the player is looking in
    */
    getDirection(player: Player) {
        const locA = player.location;
        let locB: Location;
        const [dimension, dimName] = this.getDimension(player);
        
        Server.runCommand(`execute "${player.nameTag}" ~~~ summon wedit:direction_marker ~~~`, dimName);
        
        let entity: Entity;
        for (const e of dimension.getEntitiesAtBlockLocation(this.getBlockLocation(player))) {
            if (e.id == 'wedit:direction_marker') {
                entity = e;
                entity.nameTag = 'wedit:direction_for_' + player.nameTag;
                break;
            }
        }
        
        Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name="${entity.nameTag}"] ^^^20`, dimName);
        locB = entity.location;
        Server.runCommand(`execute @e[name="${entity.nameTag}"] ~~~ tp @s ~ -256 ~`, dimName);
        entity.kill();
        entity.nameTag = 'wedit:killed';
        
        return Vector.sub(locB, locA).normalized();
    }
    
    /**
    * Gives the dimension the player is currently in
    * @remark This will be depracated in Minecraft 1.18 in favour of {mojang-minecraft.Player.dimension}.
    * @param player The player being queried
    * @return An array containing the dimension object and its name
    */
    getDimension(player: Player): [Dimension, dimension] {
        if (this.playerDimensions.get(player.nameTag)?.[0]) {
            return <[Dimension, dimension]> this.playerDimensions.get(player.nameTag).slice(1);
        }
    
        const blockLoc = this.getBlockLocation(player);
        for (const dimName of <dimension[]> ['overworld', 'nether', 'the end']) {
            const dimension: Dimension = World.getDimension(dimName);
            const entities: Entity[] = dimension.getEntitiesAtBlockLocation(blockLoc);
            for (const entity of entities) {
                if (entity.id == 'minecraft:player' && entity.nameTag == player.nameTag) {
                    this.playerDimensions.set(player.nameTag, [true, dimension, dimName]);
                    return [dimension, dimName];
                }
            }
        }
        return <[Dimension, dimension]> this.playerDimensions.get(player.nameTag).slice(1) || [null, null];
    }
    
    /**
    * Tells you whether the player's hotbar has been stashed in a temporary place.
    * @param player The player being queried
    * @return Whether the player's hotbar has been stashed
    */
    isHotbarStashed(player: Player) {
        return !Server.runCommand(`testfor @e[type=wedit:inventory_stasher,name="wedit:stasher_for_${player.nameTag}"]`).error;
    }
    
    /**
    * Stashes the player's hotbar in a temporary entity.
    * @param player The player being affected
    * @return True if the player's hotbar has already been stashed; false otherwise
    */
    stashHotbar(player: Player) {
        if (this.isHotbarStashed(player)) {
            return true;
        }
        
        const stasher = this.getDimension(player)[0].spawnEntity('wedit:inventory_stasher', new BlockLocation(player.location.x, 512, player.location.z));
        stasher.nameTag = 'wedit:stasher_for_' + player.nameTag;
        
        const inv: InventoryComponentContainer = player.getComponent('inventory').container;
        const inv_stash: InventoryComponentContainer = stasher.getComponent('inventory').container;
        for (let i = 0; i < 9; i++) {
            inv.transferItem(i, i, inv_stash);
        }
        return false;
    }
    
    /**
    * Restores the player's hotbar from a temporary entity.
    * @param player The player being affected
    * @return True if the player's hotbar hasn't been stashed yet; false otherwise
    */
    restoreHotbar(player: Player) {
        let stasher: Entity;
        const dimension = this.getDimension(player)[1];
        const stasherName = 'wedit:stasher_for_' + player.nameTag;
        Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name="${stasherName}"] ~ 512 ~`, dimension);
        for (const entity of World.getDimension(dimension).getEntitiesAtBlockLocation(new BlockLocation(Math.floor(player.location.x), 512, Math.floor(player.location.z)))) {
            if (entity.nameTag == stasherName) {
                stasher = entity;
                break;
            }
        }
        
        if (stasher) {
            const inv: InventoryComponentContainer = player.getComponent('inventory').container;
            const inv_stash: InventoryComponentContainer = stasher.getComponent('inventory').container;
            for (let i = 0; i < 9; i++) {
                if (inv.getItem(i) && inv_stash.getItem(i)) {
                    inv.swapItems(i, i, inv_stash);
                } else if (inv.getItem(i)) {
                    inv.transferItem(i, i, inv_stash);
                } else {
                    inv_stash.transferItem(i, i, inv);
                }
            }
            Server.runCommand(`tp @e[name="${stasherName}"] ~ -256 ~`, dimension);
            stasher.triggerEvent('wedit:kill');
            stasher.nameTag = 'wedit:killed';
            return false;
        } else {
            return true;
        }
    }
}

export const PlayerUtil = new PlayerHandler();