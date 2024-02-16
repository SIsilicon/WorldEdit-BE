import { Player, system, world } from "@minecraft/server";
import { getTickingAreas, print, printerr, setTickingAreas } from "./util.js";

// Check if configuration is properly loaded
if (!config.commandPrefix) {
    world.getAllPlayers().forEach(player => printerr("WorldEdit failed to load configuration!", player, false));
    throw new Error("Configuration is not properly loaded! If this is a server, \"variables.json\" is required.");
}

import { contentLog, Server, configuration, removeTickingArea } from "@notbeer-api";
import { getSession, removeSession } from "./sessions.js";
import { PlayerUtil } from "@modules/player_util.js";
import config from "config.js";

import "./commands/command_list.js";
import "./tools/tool_list.js";
import "./ui/index.js";

Server.setMaxListeners(256);
configuration.multiThreadingTimeBudget = config.asyncTimeBudget;
const activeBuilders: Player[] = [];

Server.on("worldInitialize", () => {
    system.run(() => {
        for (const tickingArea of getTickingAreas()) {
            if (!tickingArea) continue;
            for (const dim of ["overworld", "nether", "the_end"]) {
                if (!removeTickingArea(tickingArea, world.getDimension(dim))) break;
            }
        }
        setTickingAreas([]);
    });
});

let ready = false;
Server.on("ready", ev => {
    contentLog.debug(`World has been loaded in ${ev.loadTime} ticks!`);
    ready = true;
});

Server.on("playerLoaded", ev => {
    contentLog.debug(`player ${ev.player.name} loaded.`);
    if (ready) {
        makeBuilder(ev.player);
    }
});

Server.on("playerLeave", ev => {
    contentLog.debug(`player ${ev.playerName} left.`);
    removeBuilder(ev.playerId);
});

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
    }

    for (let i = activeBuilders.length - 1; i >= 0; i--) {
        try {
            // Just testing
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const name = activeBuilders[i].name;
        } catch {
            contentLog.debug("A builder no longer exists!");
            activeBuilders.splice(i, 1);
            continue;
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
    if (hasWorldEdit(player) && !activeBuilders.includes(player)) {
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