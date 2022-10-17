import "./util.js";
import "./commands/command_list.js";

import { Player, world } from "@minecraft/server";
import { contentLog, listTickingAreas, removeTickingArea, Server, configuration } from "@notbeer-api";
import { print } from "./util.js";
import { getSession, removeSession } from "./sessions.js";
import { PlayerUtil } from "@modules/player_util.js";
import { ASYNC_TIME_BUDGET } from "@config.js";

Server.setMaxListeners(256);
configuration.multiThreadingTimeBudget = ASYNC_TIME_BUDGET;
const activeBuilders: Player[] = [];

let ready = false;
Server.on("ready", ev => {
  Server.runCommand("gamerule showtags false");
  // Server.runCommand(`gamerule sendcommandfeedback ${DEBUG}`);
  contentLog.debug(`World has been loaded in ${ev.loadTime} ticks!`);
  ready = true;

  for (const area of listTickingAreas()) {
    if (area.startsWith("wedit:")) {
      removeTickingArea(area);
    }
  }
});

Server.on("playerJoin", ev => {
  contentLog.debug(`player ${ev.player.name} joined.`);
  makeBuilder(ev.player);
});

Server.on("playerLeave", ev => {
  contentLog.debug(`player ${ev.playerName} left.`);
  removeBuilder(ev.playerName);
});

Server.on("tick", () => {
  if (!ready) return;

  for (const entity of world.getPlayers()) {
    const player = entity as Player;
    if (!activeBuilders.includes(player)) {
      if (PlayerUtil.isHotbarStashed(player)) {
        PlayerUtil.restoreHotbar(player);
      }
      if (!makeBuilder(player)) { // Attempt to make them a builder.
        print("worldedit.permission.granted", player);
        continue;
      }
    }
  }

  for (let i = activeBuilders.length - 1; i >= 0; i--) {
    try {
      // Just testing
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const name = activeBuilders[i].name;
    } catch {
      contentLog.debug("A builder no longer exists!");
      activeBuilders.splice(i, 1);
    }

    const builder = activeBuilders[i];
    if (hasWorldEdit(builder)) {
      getSession(builder);
    } else {
      removeBuilder(builder.name);
      contentLog.log(`${builder.name} has been revoked of their worldedit permissions.`);
      print("worldedit.permission.revoked", builder);
      continue;
    }
  }
});

function makeBuilder(player: Player) {
  if (hasWorldEdit(player)) {
    getSession(player);
    activeBuilders.push(player);
    contentLog.log(`${player.name} has been given worldedit permissions.`);
    return false;
  }

  return true;
}

function removeBuilder(player: string) {
  let i = -1;
  do {
    i = activeBuilders.findIndex(p => {
      try {
        return p.name == player;
      } catch (e) {
        return true;
      }
    });
    if (i != -1) activeBuilders.splice(i, 1);
  } while (i != -1);

  removeSession(player);
  contentLog.debug("Removed player from world edit!");
}

function hasWorldEdit(player: Player) {
  for (const tag of player.getTags()) {
    if (tag.startsWith("worldedit")) {
      return true;
    }
  }
  return false;
}