import { Vector } from "@notbeer-api";
import { BlockLocation, Dimension, world } from "mojang-minecraft";

export function addTickingArea(start: BlockLocation, end: BlockLocation, dimension: Dimension, name: string, preload = false) {
  try {
    dimension.runCommand(
      `tickingarea add ${Vector.from(start).print()} ${Vector.from(end).print()} ${name} ${preload}`
    );
    return true;
  } catch (err) {
    return false;
  }
}

export function removeTickingArea(name: string) {
  try {
    world.getDimension("overworld").runCommand(`tickingarea remove ${name}`);
  } catch (err) {
    try {
      world.getDimension("nether").runCommand(`tickingarea remove ${name}`);
    } catch (err) {
      try {
        world.getDimension("the_end").runCommand(`tickingarea remove ${name}`);
      } catch (error) {
        return false;
      }
    }
  }
  return true;
}

export function listTickingAreas(dimension?: Dimension) {
  try {
    const cmd: string = (dimension ?? world.getDimension("overworld")).runCommand(
      `tickingarea list ${dimension ? "" : "all-dimensions"}`
    ).statusMessage;
    const areas: string[] = [];
    for (const line of cmd.split("\n")) {
      if (line.startsWith("-")) {
        const match = line.match(/- (.+): (.+) to (.+)/);
        areas.push(match[1]);
      }
    }
    return areas;
  } catch (err) {
    return [] as string[];
  }
}
