import { Server, Vector } from "@notbeer-api";
import { BlockLocation, Dimension } from "@minecraft/server";

export async function addTickingArea(start: BlockLocation, end: BlockLocation, dimension: Dimension, name: string, preload = false) {
  return Server.runCommand(
    `tickingarea add ${Vector.from(start).print()} ${Vector.from(end).print()} ${name} ${preload}`, dimension
  ).then(result => result.error);
}

export async function removeTickingArea(name: string) {
  return Server.runCommand(`tickingarea remove ${name}`)
    .then(result => result.error);
}
