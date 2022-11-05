import { DynamicPropertiesDefinition, Player, world } from "@minecraft/server";
import { contentLog, Server, configuration } from "@notbeer-api";
import { print } from "./util.js";
import { getSession, removeSession } from "./sessions.js";
import { PlayerUtil } from "@modules/player_util.js";
import config from "config.js";

import "./commands/command_list.js";
import "./tools/register_tools.js";
import "./ui/index.js";

Server.setMaxListeners(256);
configuration.multiThreadingTimeBudget = config.asyncTimeBudget;
const activeBuilders: Player[] = [];

Server.on("worldInitialize", ev => {
  try {
    const def = new DynamicPropertiesDefinition();
    def.defineString("wedit_ticking_areas", 500);
    ev.propertyRegistry.registerWorldDynamicProperties(def);
    contentLog.debug("Initialized dynamic properties");
  } catch (e) { contentLog.error(e); }
});

let ready = false;
Server.on("ready", ev => {
  contentLog.debug(`World has been loaded in ${ev.loadTime} ticks!`);
  ready = true;
});

// Don't know what this does, but will leave it just in case.
world.events.messageReceive.subscribe(ev => {
  contentLog.debug("Hello");
  contentLog.debug("id: ", ev.id);
  contentLog.debug("sourceType: ", ev.sourceType);
  contentLog.debug("message: ", ev.message);
});

Server.on("playerJoin", ev => {
  contentLog.debug(`player ${ev.player.name} joined.`);
  makeBuilder(ev.player);
});

Server.on("playerLeave", ev => {
  contentLog.debug(`player ${ev.playerName} left.`);
  removeBuilder(ev.playerName);
});

let executed = false;

Server.on("tick", () => {
  if (!ready) return;

  for (const player of world.getPlayers()) {
    if (!activeBuilders.includes(player)) {
      if (PlayerUtil.isHotbarStashed(player)) {
        PlayerUtil.restoreHotbar(player);
      }
      if (!makeBuilder(player)) { // Attempt to make them a builder.
        print("worldedit.permission.granted", player);
        continue;
      }
    }

    if (config.debug && player.isSneaking && !executed) {
      executed = true;
      // fillMap(PlayerUtil.getBlockLocation(player));
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