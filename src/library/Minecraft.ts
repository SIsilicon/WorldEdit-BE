import { world, system, PlayerSpawnAfterEvent, WatchdogTerminateReason } from "@minecraft/server";
import { shutdownTimers } from "./utils/scheduling.js";
import { shutdownThreads } from "./utils/multithreading.js";
import { RawText } from "./utils/index.js";

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
import { ServerBuilder } from "./classes/serverBuilder.js";
import { UIForms } from "./classes/uiFormBuilder.js";
import { Block } from "./classes/blockBuilder.js";

export { CustomArgType, CommandPosition } from "./classes/commandBuilder.js";
export { commandSyntaxError, registerInformation as CommandInfo } from "./@types/classes/CommandBuilder";
export { Databases } from "./classes/databaseBuilder.js";
export { configuration } from "./configurations.js";

class ServerBuild extends ServerBuilder {
    public block = Block;
    public player = PlayerBuilder;
    public command = Command;
    public uiForms = UIForms;

    constructor() {
        super();
        this._buildEvent();
        this._buildCommands();
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
         * Emit to 'itemUseBeforeOn' event listener
         */
        beforeEvents.playerInteractWithBlock.subscribe((data) => this.emit("itemUseOnBefore", data));

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
        afterEvents.worldLoad.subscribe(() => this.emit("ready", { loadTime: tickCount }));
        /**
         * Emit to 'playerChangeDimension' event listener
         */
        afterEvents.playerDimensionChange.subscribe((data) => this.emit("playerChangeDimension", { player: data.player, dimension: data.player.dimension }));

        /**
         * Emit to 'entityCreate' event listener
         */
        afterEvents.entitySpawn.subscribe((data) => {
            if (data.entity?.isValid) this.emit("entityCreate", data);
        });

        let tickCount = 0;
        let prevTime = Date.now();
        system.runInterval(() => {
            tickCount++;

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

    private _buildCommands() {
        // system.beforeEvents.startup.subscribe((ev) => {
        //     for (const command of this.command.getAllRegistation()) {
        //         if (command.name === "help") continue;
        //         const names = [command.name, ...(command.aliases ?? [])];
        //         type Parameters = { mandatoryParameters: CustomCommandParameter[]; optionalParameters: CustomCommandParameter[] };
        //         const usages: Array<[string[], Parameters]> = [];
        //         const accumulate = (params: Parameters, subs: Array<string>, argDefs: commandArgList, subName = "") => {
        //             params = { mandatoryParameters: [...params.mandatoryParameters], optionalParameters: [...params.optionalParameters] };
        //             subs = [...subs];
        //             let hasSubCommand = false;
        //             if (subName) subs.push(subName);
        //             argDefs?.forEach((arg) => {
        //                 if ("subName" in arg) {
        //                     hasSubCommand = true;
        //                     accumulate(params, subs, arg.args, arg.subName);
        //                 } else {
        //                     const list = "default" in arg ? params.optionalParameters : params.mandatoryParameters;
        //                     const types = {
        //                         bool: CustomCommandParamType.Boolean,
        //                         int: CustomCommandParamType.Integer,
        //                         float: CustomCommandParamType.Float,
        //                         string: CustomCommandParamType.String,
        //                         xyz: CustomCommandParamType.Location,
        //                         enum: CustomCommandParamType.Enum,
        //                     }[arg.type];
        //                     let name = arg.name;
        //                     const customEnumValues = this.command.getCustomArgEnums(arg.type);
        //                     if (arg.type === "enum" || customEnumValues) {
        //                         name = `wedit:${name}`;
        //                         try {
        //                             ev.customCommandRegistry.registerEnum(name, (<commandEnum>arg).values ?? customEnumValues);
        //                         } catch {
        //                             if (!customEnumValues) contentLog.warn("Warning: Enum name already exists", name);
        //                         }
        //                     } else {
        //                         name += types === undefined ? `: ${arg.type}` : "";
        //                     }
        //                     list.push({ name, type: types ?? (customEnumValues ? CustomCommandParamType.Enum : CustomCommandParamType.String) });
        //                 }
        //             });
        //             if (!hasSubCommand) usages.push([subs, params]);
        //         };
        //         accumulate({ mandatoryParameters: [], optionalParameters: [] }, [], this.command.getRegistration(command.name).usage ?? []);
        //         for (const name of names) {
        //             for (const [subCommands, params] of usages) {
        //                 ev.customCommandRegistry.registerCommand(
        //                     {
        //                         name: `wedit:${
        //                             name +
        //                             (subCommands.length
        //                                 ? subCommands
        //                                       .map((sub) => "_" + sub.replace(/^_+|_+$/g, ""))
        //                                       .filter((str) => str !== "_")
        //                                       .join("")
        //                                 : "")
        //                         }`,
        //                         description: command.description,
        //                         permissionLevel: CommandPermissionLevel.Any,
        //                         ...params,
        //                     },
        //                     (origin, ...args) => {
        //                         if (!origin.sourceEntity?.matches({ type: "player" })) return { message: "WorldEdit commands can only be ran by players", status: CustomCommandStatus.Failure };
        //                         this.command.callCommand(
        //                             <Player>origin.sourceEntity,
        //                             command.name,
        //                             args.map((arg) => `${arg}`),
        //                             subCommands
        //                         );
        //                         return { message: "", status: CustomCommandStatus.Success };
        //                     }
        //                 );
        //             }
        //         }
        //     }
        // });
    }
}

_server = new ServerBuild();
export const Server = _server;
