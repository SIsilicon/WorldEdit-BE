import { Block, BlockLocation, Dimension, Location, Player, world } from "@minecraft/server";
import { Server, RawText, addTickingArea as addTickArea, removeTickingArea as removeTickArea } from "@notbeer-api";
import config from "config.js";

/**
 * Sends a message to a player through either chat or the action bar.
 * @param msg The message to send
 * @param player The one to send the message to
 * @param toActionBar If true the message goes to the player's action bar; otherwise it goes to chat
 */
export function print(msg: string | RawText, player: Player, toActionBar = false) {
  if (typeof msg == "string") {
    msg = <RawText> RawText.translate(msg);
  }
  let command: string;
  if (toActionBar && config.printToActionBar) {
    command = `titleraw @s actionbar ${msg.toString()}`;
  } else {
    command = `tellraw @s ${msg.toString()}`;
  }
  Server.runCommand(command, player);
}

/**
 * Acts just like {print} but also prepends '§c' to make the message appear red.
 * @see {print}
 */
export function printerr(msg: string | RawText, player: Player, toActionBar = false) {
  if (!(msg instanceof RawText)) {
    msg = <RawText> RawText.translate(msg);
  }
  print(msg.prepend("text", "§c"), player, toActionBar);
}

const worldY = new Map<Dimension, [number, number]>();
function findHeightLimits(dim: Dimension) {
  const limits: [number, number] = [null, null];

  for (const p of world.getPlayers()) {
    if (p.dimension != dim) {
      continue;
    }

    for (let i = -512; i <= 512; i += 16) {
      const canPlace = canPlaceBlock(new BlockLocation(p.location.x, i, p.location.z), dim);
      if (limits[0] == null) {
        if (canPlace) {
          limits[0] = i;
        }
      } else if (limits[1] == null) {
        if (!canPlace) {
          limits[1] = i - 1;
        }
      }
    }
    break;
  }

  if (limits[0] != null && limits[1] != null) {
    worldY.set(dim, limits);
  }
}

/**
 * Gets the minimum and maximum Y levels of a dimension.
 * @param dim The dimension we're querying.
 * @return The minimum and maximum Y levels.
 */
export function getWorldHeightLimits(dim: Dimension) {
  if (!worldY.has(dim)) {
    findHeightLimits(dim);
  }
  return worldY.get(dim) ?? [ -512, 511 ];
}

/**
 * Tests if a block can be placed in a certain location of a dimension.
 * @param loc The location we are testing
 * @param dim The dimension we are testing in
 * @return Whether a block can be placed
 */
export function canPlaceBlock(loc: BlockLocation, dim: Dimension) {
  try {
    const block = dim.getBlock(loc);
    block.setPermutation(block.permutation);
    return true;
  } catch {
    return false;
  }
}

export function blockHasNBTData(block: Block) {
  const components = [
    "minecraft:inventory",
    "minecraft:sign",
    "minecraft:piston",
    "minecraft:recordPlayer",
    "minecraft:waterContainer",
    "minecraft:lavaContainer",
    "minecraft:snowContainer",
    "minecraft:potionContainer"
  ];
  const nbt_blocks = [
    "minecraft:undyed_shulker_box", "minecraft:shulker_box",
    "minecraft:furnace", "minecraft:lit_furnace",
    "minecraft:blast_furnace", "minecraft:lit_blast_furnace",
    "minecraft:smoker", "minecraft:lit_smoker",
    "minecraft:bee_nest", "minecraft:beehive",
    "minecraft:frame", "minecraft:glow_frame",
    "minecraft:command_block", "minecraft:chain_command_block",
    "minecraft:repeating_command_block", "minecraft:structure_block",
    "minecraft:barrel", "minecraft:dispenser",
    "minecraft:dropper", "minecraft:hopper",
    "minecraft:lectern", "minecraft:flower_pot",
    "minecraft:noteblock", "minecraft:mob_spawner",
    "minecraft:standing_banner", "minecraft:wall_banner",
    "minecraft:skull",
    "minecraft:brewing_stand",
    "minecraft:snow_layer",
    "minecraft:end_gateway", // TEST
    "minecraft:beacon",
  ];
  return components.some(component => !!block.getComponent(component)) || nbt_blocks.includes(block.typeId);
}

function getTickingAreas() {
  return (world.getDynamicProperty("wedit_ticking_areas") as string)?.split(",") ?? [];
}

function setTickingAreas(tickingAreas: string[]) {
  world.setDynamicProperty("wedit_ticking_areas", tickingAreas.join(","));
}

export async function addTickingArea(name: string, dim: Dimension, start: BlockLocation, end: BlockLocation) {
  const tickingAreas = getTickingAreas();
  if (tickingAreas.length >= 10) {
    return true;
  }
  if (!await addTickArea(start, end, dim, name, true)) {
    tickingAreas.push(name);
    setTickingAreas(tickingAreas);
    return false;
  }
  return true;
}

export async function removeTickingArea(name: string) {
  const tickingAreas = getTickingAreas();
  if (!tickingAreas.includes(name)) {
    return true;
  }
  if(!await removeTickArea(name)) {
    setTickingAreas(tickingAreas.splice(tickingAreas.indexOf(name)));
    return false;
  }
  return true;
}

Server.on("ready", () => {
  for (const tickingArea of getTickingAreas()) {
    removeTickArea(tickingArea);
  }
  setTickingAreas([]);
});

/**
 * Converts a location object to a string.
 * @param loc The object to convert
 * @param pretty Whether the function should include brackets and commas in the string. Set to false if you're using this in a command.
 * @return A string representation of the location
 */
export function printLocation(loc: BlockLocation | Location, pretty = true) {
  if (pretty)
    return `(${loc.x}, ${loc.y}, ${loc.z})`;
  else
    return `${loc.x} ${loc.y} ${loc.z}`;
}

/**
 * Converts loc to a string
 */
export function locToString(loc: BlockLocation) {
  return `${loc.x}_${loc.y}_${loc.z}`;
}

/**
 * Converts string to a BlockLocation
 */
export function stringToLoc(loc: string) {
  return new BlockLocation(...loc.split("_").map(str => Number.parseInt(str)) as [number, number, number]);
}

/**
 * Wraps `num` between 0 and `range` exclusive
 */
export function wrap(range: number, num: number) {
  return num >= 0 ? num % range : (num % range + range) % range;
}