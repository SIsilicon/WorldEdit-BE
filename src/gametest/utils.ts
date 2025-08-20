import { GameMode } from "@minecraft/server";
import { Test } from "@minecraft/server-gametest";
import { sleep, Vector } from "@notbeer-api";
import { hasSession } from "server/sessions";

export async function spawnWorldEditPlayer(test: Test, location: Vector, name: string) {
    const player = test.spawnSimulatedPlayer(location, name, GameMode.Creative);
    player.addTag("worldedit");
    while (!hasSession(player.id)) await sleep(1);
    return player;
}
