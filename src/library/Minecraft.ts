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
      const date = new Date();
      /**
       * Emit to 'beforeMessage' event listener
       */
      this.emit("beforeMessage", data);
      /**
       * This is for the command builder and a emitter
       */
      // CHANGES HERE
      if(!data.message.startsWith(this.command.prefix)) return;
      data.cancel = true;
      const msg = data.message;
      data.message = data.message.substring(this.command.prefix.length);

      function regexIndexOf(text: string, re: RegExp, index: number) {
        const i = text.slice(index).search(re);
        return i == -1 ? -1 : i + index;
      }

      const command = msg.split(/\s+/)[0].slice(1);
      const getCommand = Command.getAllRegistation().some(element => element.name === command || element.aliases && element.aliases.includes(command));
      if(!getCommand) {
        data.cancel = true;
        RawText.translate("commands.generic.unknown").with(`${command}`).printError(data.sender);
        return;
      }

      const args: Array<string> = [];
      const offsets: Array<number> = [];
      let i = regexIndexOf(msg, /[^\s]/, this.command.prefix.length + command.length);
      while(i < msg.length && i != -1) {
        const quoted = msg[i] == "\"";

        let idx: number;
        if (quoted) {
          i++;
          idx = regexIndexOf(msg, /"/, i);
        } else {
          idx = regexIndexOf(msg, /\s/, i);
        }

        if (idx == -1) {
          args.push(msg.slice(i));
          // printDebug(i, msg.slice(i), 'end');
          offsets.push(i);
          break;
        } else {
          args.push(msg.slice(i, idx));
          // printDebug(i, msg.slice(i, idx), idx);
          offsets.push(i);
          i = regexIndexOf(msg, /[^\s]/, idx + (quoted ? 1:0));
          // printDebug('new i:', i);
        }
      }

      for (const element of Command.getAllRegistation()) {
        if(!(element.name == command || element.aliases?.includes(command))) continue;

        /**
      * Registration callback
      */
        try {
          if (element.permission && !this.player.hasPermission(data.sender, element.permission)) {
            throw RawText.translate("commands.generic.wedit:noPermission");
          }
          element.callback(data, Command.parseArgs(command, args));
        } catch(e) {
          if(e.isSyntaxError) {
            contentLog.error(e.stack);
            if(e.idx == -1 || e.idx >= args.length) {
              RawText.translate("commands.generic.syntax")
                .with(msg)
                .with("")
                .with("")
                .printError(data.sender);
            } else {
              let start = offsets[e.idx];
              if(e.start) start += e.start;
              let end = start + args[e.idx].length;
              if(e.end) end = start + e.end;
              RawText.translate("commands.generic.syntax")
                .with(msg.slice(0, start))
                .with(msg.slice(start, end))
                .with(msg.slice(end))
                .printError(data.sender);
            }
          } else {
            if (e instanceof RawText) {
              e.printError(data.sender);
            } else {
              RawText.text(e).printError(data.sender);
              if (e.stack) {
                RawText.text(e.stack).printError(data.sender);
              }
            }
          }
        }
        /**
      * Emit to 'customCommand' event listener
      */
        this.emit("customCommand", {
          registration: element,
          data,
          createdAt: date,
          createdTimestamp: date.getTime()
        });
        break;
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
