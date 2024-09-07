import { world, system, PlayerSpawnAfterEvent, WatchdogTerminateReason } from "@minecraft/server";
import { shutdownTimers } from "./utils/scheduling.js";
import { shutdownThreads } from "./utils/multithreading.js";
import { contentLog, RawText } from "./utils/index.js";

// eslint-disable-next-line prefer-const
let _server: ServerBuild;

system.beforeEvents.watchdogTerminate.subscribe((ev) => {
    if (ev.terminateReason == WatchdogTerminateReason.Hang) {
        ev.cancel = true;
        shutdownTimers();
        shutdownThreads();
        if (_server) _server.shutdown();

        const players = Array.from(world.getPlayers());
        if (players.length == 0) {
            const event = (ev: PlayerSpawnAfterEvent) => {
                if (!ev.initialSpawn) return;
                world.afterEvents.playerSpawn.unsubscribe(event);
                RawText.translate("script.watchdog.error.hang").print(ev.player);
            };
            system.run(() => world.afterEvents.playerSpawn.subscribe(event));
        } else {
            for (const player of players) {
                RawText.translate("script.watchdog.error.hang").print(player);
            }
        }
    }
});

export * from "./utils/index.js";

import { Player as PlayerBuilder } from "./classes/playerBuilder.js";
import { Command } from "./classes/commandBuilder.js";
import { Structure } from "./classes/structureBuilder.js";
import { ServerBuilder } from "./classes/serverBuilder.js";
import { UIForms } from "./classes/uiFormBuilder.js";
import { Block } from "./classes/blockBuilder.js";

export { CustomArgType, CommandPosition } from "./classes/commandBuilder.js";
export { commandSyntaxError, registerInformation as CommandInfo } from "./@types/classes/CommandBuilder";
export { StructureSaveOptions, StructureLoadOptions } from "./classes/structureBuilder.js";
export { getDatabase } from "./classes/databaseBuilder.js";
export { configuration } from "./configurations.js";

class ServerBuild extends ServerBuilder {
    public block = Block;
    public player = PlayerBuilder;
    public command = Command;
    public uiForms = UIForms;
    public structure = Structure;

    constructor() {
        super();
        this._buildEvent();
    }
    /**
     * @private
     */
    private _buildEvent() {
        const beforeEvents = world.beforeEvents;
        const afterEvents = world.afterEvents;

        beforeEvents.chatSend.subscribe((data) => {
            /**
             * Emit to 'beforeMessage' event listener
             */
            this.emit("beforeMessage", data);
            /**
             * This is for the command builder and a emitter
             */
            const msg = data.message;
            if (!msg.startsWith(this.command.prefix)) return;
            data.cancel = true;
            const command = msg.split(/\s+/)[0].slice(this.command.prefix.length);
            this.command.callCommand(data.sender, command, msg.substring(msg.indexOf(command) + command.length).trim());
        });
        /**
         * Emit to 'beforeExplosion' event listener
         */
        beforeEvents.explosion.subscribe((data) => this.emit("beforeExplosion", data));
        /**
         * Emit to 'blockExplode' event listener
         */
        afterEvents.blockExplode.subscribe((data) => this.emit("blockExplode", data));
        /**
         * Emit to 'beforeExplosion' event listener
         */
        beforeEvents.explosion.subscribe((data) => this.emit("explosion", data));
        /**
         * Emit to 'pistonActivate' event listener
         */
        afterEvents.pistonActivate.subscribe((data) => this.emit("pistonActivate", data));
        /**
         * Emit to 'itemUse' event listener
         */
        beforeEvents.itemUse.subscribe((data) => this.emit("itemUseBefore", data));

        /**
         * Emit to 'itemUseBeforeOm' event listener
         */
        beforeEvents.itemUseOn.subscribe((data) => this.emit("itemUseOnBefore", data));

        /**
         * Emit to 'messageCreate' event listener
         */
        afterEvents.chatSend.subscribe((data) => this.emit("messageCreate", data));
        /**
         * Emit to 'entityEffected' event listener
         */
        afterEvents.effectAdd.subscribe((data) => this.emit("entityEffected", data));
        /**
         * Emit to 'weatherChange' event listener
         */
        afterEvents.weatherChange.subscribe((data) => this.emit("weatherChange", data));
        /**
         * Emit to 'entityCreate' event listener
         */
        afterEvents.entitySpawn.subscribe((data) => this.emit("entityCreate", data));
        /**
         * Emit to 'blockBreak' event listener
         */
        beforeEvents.playerBreakBlock.subscribe((data) => this.emit("blockBreak", data));
        /**
         * Emit to 'blockHit' event listener
         */
        afterEvents.entityHitBlock.subscribe((data) => this.emit("blockHit", data));
        /**
         * Emit to 'worldInitialize' event listener
         */
        afterEvents.worldInitialize.subscribe((data) => this.emit("worldInitialize", data));
        /**
         * Emit to 'playerChangeDimension' event listener
         */
        afterEvents.playerDimensionChange.subscribe((data) => this.emit("playerChangeDimension", { player: data.player, dimension: data.player.dimension }));

        let worldLoaded = false;
        let tickCount = 0;
        let prevTime = Date.now();
        system.runInterval(() => {
            tickCount++;
            if (!worldLoaded && world.getAllPlayers().length) {
                /**
                 * Emit to 'ready' event listener
                 */
                try {
                    this.emit("ready", { loadTime: tickCount });
                } catch (e) {
                    contentLog.error(e);
                }
                worldLoaded = true;
            }

            this.emit("tick", {
                currentTick: tickCount,
                deltaTime: Date.now() - prevTime,
            });

            prevTime = Date.now();
        });

        /**
         * Emit to 'playerSpawn' event listener
         */
        afterEvents.playerSpawn.subscribe((data) => {
            if (data.initialSpawn) {
                this.emit("playerLoaded", data);
            }
        });
        /**
         * Emit to 'playerJoin' event listener
         */
        afterEvents.playerJoin.subscribe((data) => {
            this.emit("playerJoin", { playerName: data.playerName });
        });
        /**
         * Emit to 'playerLeave' event listener
         */
        afterEvents.playerLeave.subscribe((data) => {
            this.emit("playerLeave", data);
        });
    }
}

_server = new ServerBuild();
export const Server = _server;
