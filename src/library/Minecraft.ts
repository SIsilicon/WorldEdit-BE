import { clearTickInterval, clearTickTimeout, setTickInterval, setTickTimeout } from "./utils/scheduling.js";
export { clearTickInterval, clearTickTimeout, setTickInterval, setTickTimeout };

import { compressNumber, formatNumber, MS, rainbowText } from "./utils/formatter.js";
export { compressNumber, formatNumber, MS, rainbowText };

import Database from "./build/classes/databaseBuilder.js";
export { Database };

import { World } from 'mojang-minecraft';
import { Entity } from "./build/classes/entityBuilder.js";
import { Player } from "./build/classes/playerBuilder.js";
import { Command } from "./build/classes/commandBuilder.js";
import { ServerBuilder } from "./build/classes/serverBuilder.js";

import { printDebug } from '../server/util.js';

class ServerBuild extends ServerBuilder {
    public entity = Entity;
    public player = Player;
    public command = Command;
    constructor() {
        super();
        this._buildEvent();
    };
    /**
    * @private
    */
    private _buildEvent() {
        World.events.beforeChat.subscribe(data => {
                const date = new Date();
                /**
                * Emit to 'beforeMessage' event listener
                */
                this.emit('beforeMessage', data);
                /**
                * This is for the command builder and a emitter
                */
                // CHANGES HERE
                if(!data.message.startsWith(this.command.prefix)) return;
                data.cancel = true;
                const args = data.message.slice(this.command.prefix.length).trim().split(/\s+/);
                const command = args.shift().toLowerCase();
                const getCommand = Command.getAllRegistation().some(element => element.name === command || element.aliases && element.aliases.includes(command));
                if(!getCommand) {
                    data.cancel = true;
                    return this.runCommand(`tellraw "${data.sender.nameTag}" {"rawtext":[{"text":"§c"},{"translate":"commands.generic.unknown", "with": ["§f${command}§c"]}]}`);
                };
                for (const element of Command.getAllRegistation()) {
                    if(!(element.name == command || element.aliases?.includes(command))) continue;
                    
                    /**
                    * Registration callback
                    */
                    try {
                        element.callback(data, args);
                    } catch(error) {
                        this.broadcast(`§c${error}`, data.sender.nameTag);
                    };
                    /**
                    * Emit to 'customCommand' event listener
                    */
                    this.emit('customCommand', {
                        registration: element,
                        data,
                        createdAt: date,
                        createdTimestamp: date.getTime() 
                    });
                    break;
                };
        });
        /**
            * Emit to 'beforeExplosion' event listener
            */
        World.events.beforeExplosion.subscribe(data => this.emit('beforeExplosion', data));
        /**
            * Emit to 'beforePistonActivate' event listener
            */
            World.events.beforePistonActivate.subscribe(data => this.emit('beforePistonActivate', data));
        /**
            * Emit to 'blockExplode' event listener
            */
        World.events.blockExplode.subscribe(data => this.emit('blockExplode', data));
        /**
            * Emit to 'beforeExplosion' event listener
            */
        World.events.explosion.subscribe(data => this.emit('explosion', data));
        /**
            * Emit to 'beforeExplosion' event listener
            */
        World.events.pistonActivate.subscribe(data => this.emit('pistonActivate', data));
        /**
            * Emit to 'messageCreate' event listener
            */
        World.events.chat.subscribe(data => this.emit('messageCreate', data));
        /**
            * Emit to 'entityEffected' event listener
            */
        World.events.effectAdd.subscribe(data => this.emit('entityEffected', data));
        /**
            * Emit to 'weatherChange' event listener
            */
        World.events.weatherChange.subscribe(data => this.emit('weatherChange', data));
        
        let oldPlayer: Array<string> = [];
        World.events.entityCreate.subscribe(data => {
                /**
                * Emit to 'entityCreate' event listener
                */
                this.emit('entityCreate', data.entity);
        
                if(data.entity.id !== 'minecraft:player') return;
                let playerJoined = Player.list().filter(current => !oldPlayer.some(old => current === old));
                /**
                * Emit to 'playerJoin' event listener
                */
                if(playerJoined.includes(data.entity.nameTag)) this.emit('playerJoin', data.entity);
        });

        let worldLoaded = false, tickCount = 0;
        World.events.tick.subscribe((data) => {
                let currentPlayer = Player.list();
                let playerLeft = oldPlayer.filter(old => !currentPlayer.includes(old));
                
                /**
                * Emit to 'playerLeave' event listener
                */
                for(let player of playerLeft) this.emit('playerLeave', { name: player });
                oldPlayer = currentPlayer;
        
                tickCount++;
                if(!this.runCommand('testfor @a').error && !worldLoaded) {
                    /**
                    * Emit to 'ready' event listener
                    */
                    this.emit('ready', { loadTime: tickCount });
                    worldLoaded = true;
                };
                
                /**
                * Emit to 'tick' event listener
                */
                this.emit('tick', data);
                
                
        });
    };
};
/**
 * Import this constructor
 */
export const Server = new ServerBuild();