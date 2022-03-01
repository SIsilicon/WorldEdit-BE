import { Player, BlockLocation, ItemStack, Items } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { Tool } from './base_tool.js';
import { hasSession, getSession } from '../sessions.js';
import { print, printDebug } from '../util.js';

// AUTO GENERATED
const baseItems = ["minecraft:yellow_dye", "minecraft:wooden_sword", "minecraft:wooden_shovel", "minecraft:wooden_pickaxe", "minecraft:wooden_hoe", "minecraft:wooden_axe", "minecraft:white_dye", "minecraft:wheat", "minecraft:wheat_seeds", "minecraft:turtle_helmet", "minecraft:tropical_fish", "minecraft:trident", "minecraft:totem", "minecraft:totem_of_undying", "minecraft:tnt_minecart", "minecraft:sweet_berries", "minecraft:suspicious_stew", "minecraft:sugar", "minecraft:sugar_cane", "minecraft:string", "minecraft:stone_sword", "minecraft:stone_shovel", "minecraft:stone_pickaxe", "minecraft:stone_hoe", "minecraft:stone_axe", "minecraft:stick", "minecraft:splash_potion", "minecraft:spider_eye", "minecraft:speckled_melon", "minecraft:snowball", "minecraft:shears", "minecraft:scute", "minecraft:salmon", "minecraft:saddle", "minecraft:rotten_flesh", "minecraft:repeater", "minecraft:reeds", "minecraft:redstone", "minecraft:red_dye", "minecraft:rabbit", "minecraft:rabbit_stew", "minecraft:purple_dye", "minecraft:pumpkin_seeds", "minecraft:pumpkin_pie", "minecraft:pufferfish", "minecraft:potion", "minecraft:potato", "minecraft:porkchop", "minecraft:popped_chorus_fruit", "minecraft:poisonous_potato", "minecraft:pink_dye", "minecraft:painting", "minecraft:orange_dye", "minecraft:netherStar", "minecraft:netherite_leggings", "minecraft:netherite_helmet", "minecraft:netherite_chestplate", "minecraft:netherite_boots", "minecraft:nether_wart", "minecraft:nether_star", "minecraft:nautilus_shell", "minecraft:name_tag", "minecraft:muttonRaw", "minecraft:muttonCooked", "minecraft:mutton", "minecraft:music_disc_ward", "minecraft:music_disc_wait", "minecraft:music_disc_strad", "minecraft:music_disc_stal", "minecraft:music_disc_pigstep", "minecraft:music_disc_mellohi", "minecraft:music_disc_mall", "minecraft:music_disc_far", "minecraft:music_disc_chirp", "minecraft:music_disc_cat", "minecraft:music_disc_blocks", "minecraft:music_disc_13", "minecraft:music_disc_11", "minecraft:mushroom_stew", "minecraft:minecart", "minecraft:melon", "minecraft:melon_slice", "minecraft:melon_seeds", "minecraft:magenta_dye", "minecraft:lingering_potion", "minecraft:lime_dye", "minecraft:light_gray_dye", "minecraft:light_blue_dye", "minecraft:leather_leggings", "minecraft:leather_horse_armor", "minecraft:leather_helmet", "minecraft:leather_chestplate", "minecraft:leather_boots", "minecraft:lead", "minecraft:lapis_lazuli", "minecraft:kelp", "minecraft:item_frame", "minecraft:iron_sword", "minecraft:iron_shovel", "minecraft:iron_pickaxe", "minecraft:iron_nugget", "minecraft:iron_leggings", "minecraft:iron_horse_armor", "minecraft:iron_hoe", "minecraft:iron_helmet", "minecraft:iron_chestplate", "minecraft:iron_boots", "minecraft:iron_axe", "minecraft:ink_sac", "minecraft:horsearmorleather", "minecraft:horsearmoriron", "minecraft:horsearmorgold", "minecraft:horsearmordiamond", "minecraft:hopper", "minecraft:hopper_minecart", "minecraft:honeycomb", "minecraft:honey_bottle", "minecraft:green_dye", "minecraft:gray_dye", "minecraft:golden_sword", "minecraft:golden_shovel", "minecraft:golden_pickaxe", "minecraft:golden_leggings", "minecraft:golden_horse_armor", "minecraft:golden_hoe", "minecraft:golden_helmet", "minecraft:golden_chestplate", "minecraft:golden_carrot", "minecraft:golden_boots", "minecraft:golden_axe", "minecraft:golden_apple", "minecraft:gold_nugget", "minecraft:glistering_melon_slice", "minecraft:glass_bottle", "minecraft:frame", "minecraft:flower_pot", "minecraft:flint_and_steel", "minecraft:fishing_rod", "minecraft:fish", "minecraft:firework_star", "minecraft:firework_rocket", "minecraft:fireball", "minecraft:experience_bottle", "minecraft:ender_pearl", "minecraft:enchanted_golden_apple", "minecraft:enchanted_book", "minecraft:emptyMap", "minecraft:elytra", "minecraft:egg", "minecraft:dye", "minecraft:dried_kelp", "minecraft:diamond", "minecraft:diamond_sword", "minecraft:diamond_shovel", "minecraft:diamond_pickaxe", "minecraft:diamond_leggings", "minecraft:diamond_horse_armor", "minecraft:diamond_hoe", "minecraft:diamond_helmet", "minecraft:diamond_chestplate", "minecraft:diamond_boots", "minecraft:diamond_axe", "minecraft:cyan_dye", "minecraft:crossbow", "minecraft:cookie", "minecraft:cooked_salmon", "minecraft:cooked_rabbit", "minecraft:cooked_porkchop", "minecraft:cooked_mutton", "minecraft:cooked_fish", "minecraft:cooked_cod", "minecraft:cooked_chicken", "minecraft:cooked_beef", "minecraft:comparator", "minecraft:command_block_minecart", "minecraft:cod", "minecraft:cocoa_beans", "minecraft:coal", "minecraft:clownfish", "minecraft:chorus_fruit", "minecraft:chorus_fruit_popped", "minecraft:chicken", "minecraft:chest_minecart", "minecraft:chainmail_leggings", "minecraft:chainmail_helmet", "minecraft:chainmail_chestplate", "minecraft:chainmail_boots", "minecraft:cauldron", "minecraft:carrotOnAStick", "minecraft:carrot", "minecraft:carrot_on_a_stick", "minecraft:campfire", "minecraft:cake", "minecraft:bucket", "minecraft:brown_dye", "minecraft:brewing_stand", "minecraft:bread", "minecraft:bow", "minecraft:book", "minecraft:bone", "minecraft:bone_meal", "minecraft:blue_dye", "minecraft:blaze_rod", "minecraft:black_dye", "minecraft:beetroot", "minecraft:beetroot_soup", "minecraft:beetroot_seeds", "minecraft:beef", "minecraft:baked_potato", "minecraft:arrow", "minecraft:armor_stand", "minecraft:apple", "minecraft:appleEnchanted"];
// AUTO GENERATED

type toolConstruct = new (...args: any[]) => Tool;

function itemToKey(item: ItemStack) {
    return `${item.id}/${item.data}`;
}

class ToolBuilder {
    private tools = new Map<string, toolConstruct>();
    private bindings = new Map<string, Tool>();
    private fixedBindings = new Map<string, Tool>();
    
    private currentTick = 0;
    
    constructor() {
        Server.on('beforeItemUse', ev => {
            if (ev.source.id != 'minecraft:player' || !ev.item) {
                return;
            }
            this.onItemUse(ev.item, ev.source as Player);
        });
        Server.on('beforeItemUseOn', ev => {
            if (ev.source.id != 'minecraft:player' || !ev.item) {
                return;
            }
            this.onItemUse(ev.item, ev.source as Player, ev.blockLocation);
        });
        Server.on('tick', ev => {this.currentTick = ev.currentTick});
    }
    
    register(toolClass: toolConstruct, name: string, item?: string) {
        this.tools.set(name, toolClass);
        //this.pseudoTools.set(name, new toolClass());
        if (item) {
            this.fixedBindings.set(`${item}/0`, new (toolClass)());
        }
    }
    
    bind(toolId: string, player: Player, ...args: any[]) {
        this.unbind(player);
        let item = Server.player.getHeldItem(player);
        if (item) {
            if (!baseItems.includes(item.id)) {
                throw 'worldedit.tool.cantBind';
            }
            
            const tool = new (this.tools.get(toolId))(...args);
            let newId = item.id.replace('minecraft:', 'wedit:_tool_');
            let toolData = 0;
            let tries = 0;
            do {
                if (tries > 100) {
                    throw 'Failed to bind tool!';
                }
                tries++;
                // item data consists of up to 15 bits.
                toolData = Math.floor(Math.random() * 512);
                toolData = (toolData << 6) | item.data;
                // 6 least sig. bits: item's original data value.
                // 9 most sig. bits: tool's id
            } while (this.bindings.has(`${newId}/${toolData}`));
            printDebug('tool and old item data:', toolData, item.data);
            
            Server.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 destroy ${newId} 1 ${toolData}`, player);
            
            const newItem = Server.player.getHeldItem(player);
            printDebug('new item data:', newItem.data);
            this.bindings.set(itemToKey(newItem), tool);
            return tool;
        } else {
            throw 'worldedit.tool.noItem';
        }
    }
    
    unbind(player: Player) {
        const item = Server.player.getHeldItem(player);
        if (item) {
            if (this.fixedBindings.has(itemToKey(item))) {
                throw 'worldedit.tool.fixedBind';
            }
            if (!item.id.startsWith('wedit:_tool_')) {
                return;
            }
            this.bindings.delete(itemToKey(item));
            
            const toolData = item.data & 63;
            Server.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 destroy ${item.id.replace('wedit:_tool_', 'minecraft:')} 1 ${toolData}`, player);
            printDebug('old item and tool data:', toolData, item.data);
        } else {
            throw 'worldedit.tool.noItem';
        }
    }
    
    hasBinding(player: Player) {
        const item = Server.player.getHeldItem(player);
        if (item) {
            return this.bindings.has(itemToKey(item)) || this.fixedBindings.has(itemToKey(item));
        } else {
            return false;
        }
    }
    
    setProperty(player: Player, prop: string, value: any) {
        const item = Server.player.getHeldItem(player);
        if (item) {
            const tool: {[key: string]: any} = this.bindings.get(itemToKey(item));
            if (tool && prop in tool) {
                tool[prop] = value;
                return true;
            }
        }
        return false;
    }
    
    hasProperty(player: Player, prop: string) {
        const item = Server.player.getHeldItem(player);
        if (item) {
            const tool: {[key: string]: any} = this.bindings.get(itemToKey(item));
            if (tool && prop in tool) {
                return true;
            }
        }
        return false;
    }
    
    private onItemUse(item: ItemStack, player: Player, loc?: BlockLocation) {
        const key = itemToKey(item);
        let tool: Tool;
        if (this.bindings.has(key)) {
            tool = this.bindings.get(key);
        } else if (this.fixedBindings.has(key)) {
            tool = this.fixedBindings.get(key);
        } else {
            this.unbind(player);
            return;
        }
        
        if (!Server.player.hasPermission(player, tool.permission) || !hasSession(player.name)) {
            throw 'worldedit.tool.noPerm';
        }
        
        tool.process(getSession(player), this.currentTick, loc);
    }
}
export const Tools = new ToolBuilder();