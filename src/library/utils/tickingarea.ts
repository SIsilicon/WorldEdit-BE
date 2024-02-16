import { Server, Vector } from "@notbeer-api";
import { Vector3, Dimension } from "@minecraft/server";

export function addTickingArea(start: Vector3, end: Vector3, dimension: Dimension, name: string, preload = false) {
    return Server.runCommand(
        `tickingarea add ${Vector.from(start).print()} ${Vector.from(end).print()} ${name} ${preload}`, dimension
    ).error;
}

export function removeTickingArea(name: string, dimension: Dimension) {
    return Server.runCommand(`tickingarea remove ${name}`, dimension).error;
}
