import { world, system, PlayerSpawnEvent } from "@minecraft/server";
import { shutdownTimers } from "./utils/scheduling.js";
import { shutdownThreads } from "./utils/multithreading.js";
import { contentLog, RawText } from "./utils/index.js";

// eslint-disable-next-line prefer-const
let _server: ServerBuild;

system.events.beforeWatchdogTerminate.subscribe(ev => {
  if (ev.terminateReason == "hang") {
    ev.cancel = true;
    shutdownTimers();
    shutdownThreads();
    if (_server) {
      _server.shutdown();
    }

    const players = Array.from(world.getPlayers());
    if (players.length == 0) {
      const event = (ev: PlayerSpawnEvent) => {
        if (!ev.initialSpawn) return;
        world.events.playerSpawn.unsubscribe(event);
        ev.player.runCommandAsync(`tellraw @s ${RawText.translate("script.watchdog.error.hang")}`);
      };
      world.events.playerSpawn.subscribe(event);
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
export { Database } from "./classes/databaseBuilder.js";
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
    const events = world.events;

    events.beforeChat.subscribe(data => {
      /**
       * Emit to 'beforeMessage' event listener
       */
      this.emit("beforeMessage", data);
      /**
       * This is for the command builder and a emitter
       */
      const msg = data.message;
      if(!msg.startsWith(this.command.prefix)) return;
      data.cancel = true;
      const command = msg.split(/\s+/)[0].slice(this.command.prefix.length);
      if (this.command.callCommand(data.sender, command, msg.substring(msg.indexOf(command) + command.length).trim()) == undefined) {
        data.cancel = false;
      }
    });
    /**
     * Emit to 'beforeExplosion' event listener
     */
    events.beforeExplosion.subscribe(data => this.emit("beforeExplosion", data));
    /**
     * Emit to 'beforePistonActivate' event listener
     */
    events.beforePistonActivate.subscribe(data => this.emit("beforePistonActivate", data));
    /**
     * Emit to 'blockExplode' event listener
     */
    events.blockExplode.subscribe(data => this.emit("blockExplode", data));
    /**
     * Emit to 'beforeExplosion' event listener
     */
    events.explosion.subscribe(data => this.emit("explosion", data));
    /**
     * Emit to 'pistonActivate' event listener
     */
    events.pistonActivate.subscribe(data => this.emit("pistonActivate", data));

    /**
     * Emit to 'beforeItemUse' event listener
     */
    events.beforeItemUse.subscribe(data => this.emit("beforeItemUse", data));

    /**
     * Emit to 'beforeItemUseOm' event listener
     */
    events.beforeItemUseOn.subscribe(data => this.emit("beforeItemUseOn", data));

    /**
     * Emit to 'messageCreate' event listener
     */
    events.chat.subscribe(data => this.emit("messageCreate", data));
    /**
     * Emit to 'entityEffected' event listener
     */
    events.effectAdd.subscribe(data => this.emit("entityEffected", data));
    /**
     * Emit to 'weatherChange' event listener
     */
    events.weatherChange.subscribe(data => this.emit("weatherChange", data));
    /**
     * Emit to 'entityCreate' event listener
     */
    events.entitySpawn.subscribe(data => this.emit("entityCreate", data));
    /**
     * Emit to 'blockBreak' event listener
     */
    events.blockBreak.subscribe(data => this.emit("blockBreak", data));
    /**
     * Emit to 'worldInitialize' event listener
     */
    events.worldInitialize.subscribe(data => this.emit("worldInitialize", data));

    let worldLoaded = false, tickCount = 0, prevTime = Date.now();
    const playerDimensions = new Map<string, string>();
    const tickEvent = () => {
      tickCount++;
      this.runCommand("testfor @a").then(result => {
        if(!result.error && !worldLoaded) {
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
      });

      for (const player of world.getPlayers()) {
        const oldDimension = playerDimensions.get(player.name);
        const newDimension = player.dimension.id;

        if (oldDimension && oldDimension != newDimension) {
          this.emit("playerChangeDimension", {
            player: player,
            dimension: player.dimension
          });
        }
        playerDimensions.set(player.name, newDimension);
      }
      this.emit("tick", {
        currentTick: tickCount,
        deltaTime: Date.now() - prevTime
      });

      prevTime = Date.now();
      system.run(tickEvent);
    };
    system.run(tickEvent);

    /**
     * Emit to 'playerSpawn' event listener
     */
    events.playerSpawn.subscribe(data => {
      if (data.initialSpawn) {
        this.emit("playerLoaded", data);
      }
    });
    /**
     * Emit to 'playerJoin' event listener
     */
    events.playerJoin.subscribe(data => {
      this.emit("playerJoin", { playerName: data.playerName });
    });
    /**
     * Emit to 'playerLeave' event listener
     */
    events.playerLeave.subscribe(data => {
      this.emit("playerLeave", data);
    });
  }

}

_server = new ServerBuild();
export const Server = _server;
