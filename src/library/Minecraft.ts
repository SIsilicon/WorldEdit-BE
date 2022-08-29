import { contentLog, RawText } from "./utils/index.js";
export * from "./utils/index.js";

import { world } from "mojang-minecraft";
import { Entity } from "./build/classes/entityBuilder.js";
import { Player } from "./build/classes/playerBuilder.js";
import { Command } from "./build/classes/commandBuilder.js";
import { Structure } from "./structure/structureBuilder.js";
import { ServerBuilder } from "./build/classes/serverBuilder.js";

export { CustomArgType, CommandPosition } from "./build/classes/commandBuilder.js";
export { commandSyntaxError, registerInformation as CommandInfo } from "./@types/build/classes/CommandBuilder";
export { StructureSaveOptions, StructureLoadOptions } from "./structure/structureBuilder.js";
export { configuration } from "./build/configurations.js";

class ServerBuild extends ServerBuilder {
  public entity = Entity;
  public player = Player;
  public command = Command;
  public structure = Structure;

  constructor() {
    super();
    this._buildEvent();
  }
  /**
   * @private
   */
  private _buildEvent() {
    world.events.beforeChat.subscribe(data => {
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
        return this.runCommand(`tellraw @s {"rawtext":[{"text":"§c"},{"translate":"commands.generic.unknown", "with": ["§f${command}§c"]}]}`, data.sender);
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
          if (element.permission && !Player.hasPermission(data.sender, element.permission)) {
            throw "commands.generic.wedit:noPermission";
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
    world.events.beforeExplosion.subscribe(data => this.emit("beforeExplosion", data));
    /**
     * Emit to 'beforePistonActivate' event listener
     */
    world.events.beforePistonActivate.subscribe(data => this.emit("beforePistonActivate", data));
    /**
     * Emit to 'blockExplode' event listener
     */
    world.events.blockExplode.subscribe(data => this.emit("blockExplode", data));
    /**
     * Emit to 'beforeExplosion' event listener
     */
    world.events.explosion.subscribe(data => this.emit("explosion", data));
    /**
     * Emit to 'pistonActivate' event listener
     */
    world.events.pistonActivate.subscribe(data => this.emit("pistonActivate", data));

    /**
     * Emit to 'beforeItemUse' event listener
     */
    world.events.beforeItemUse.subscribe(data => this.emit("beforeItemUse", data));

    /**
        * Emit to 'beforeItemUseOm' event listener
        */
    world.events.beforeItemUseOn.subscribe(data => this.emit("beforeItemUseOn", data));

    /**
     * Emit to 'messageCreate' event listener
     */
    world.events.chat.subscribe(data => this.emit("messageCreate", data));
    /**
     * Emit to 'entityEffected' event listener
     */
    world.events.effectAdd.subscribe(data => this.emit("entityEffected", data));
    /**
     * Emit to 'weatherChange' event listener
     */
    world.events.weatherChange.subscribe(data => this.emit("weatherChange", data));
    /**
     * Emit to 'entityCreate' event listener
     */
    world.events.entityCreate.subscribe(data => this.emit("entityCreate", data));
    /**
     * Emit to 'playerJoin' event listener
     */
    world.events.playerJoin.subscribe(data => this.emit("playerJoin", data));
    /**
     * Emit to 'playerLeave' event listener
     */
    world.events.playerLeave.subscribe(data => this.emit("playerLeave", data));
    /**
     * Emit to 'blockBreak' event listener
     */
    world.events.blockBreak.subscribe(data => this.emit("blockBreak", data));
    let worldLoaded = false, tickCount = 0;
    const playerDimensions = new Map<string, string>();
    world.events.tick.subscribe((data) => {
      tickCount++;
      if(!this.runCommand("testfor @a").error && !worldLoaded) {
        /**
         * Emit to 'ready' event listener
         */
        this.emit("ready", { loadTime: tickCount });
        worldLoaded = true;
      }

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

      /**
       * Emit to 'tick' event listener
       */
      this.emit("tick", data);
    });
  }

}
/**
 * Import this constructor
 */
export const Server = new ServerBuild();