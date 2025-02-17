import { world, Player, Entity, Dimension, CommandResult } from "@minecraft/server";
import { EventEmitter } from "./eventEmitter.js";
import { runCommandReturn } from "../@types/classes/ServerBuilder";
import { sleep } from "@notbeer-api";

export class ServerBuilder extends EventEmitter {
    private commandQueue: Promise<runCommandReturn>[] = [];
    private flushingCommands = false;

    /**
     * Force shuts down the server
     * @example ServerBuilder.close()
     */
    close(): void {
        function crash() {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                crash();
            }
        }
        crash();
    }

    /**
     * Run a command in game
     * @param command The command you want to run
     * @returns {runCommandReturn}
     * @example ServerBuilder.runCommand('say Hello World!');
     */
    runCommand(command: string, target?: Dimension | Player | Entity): runCommandReturn {
        try {
            const successCount = (target ?? world.getDimension("overworld")).runCommand(command).successCount;
            return { error: false, successCount };
        } catch (e) {
            return { error: true, successCount: 0 };
        }
    }

    /**
     * Queue a command in game
     * @param command The command you want to run at some point
     * @returns {Promise<runCommandReturn>}
     * @example ServerBuilder.queueCommand('say Hello World!');
     */
    queueCommand(command: string, target?: Dimension | Player | Entity): Promise<runCommandReturn> {
        try {
            if (this.flushingCommands || this.commandQueue.length > 128) throw "queue";

            const promise = new Promise<CommandResult>((resolve) => {
                resolve((target ?? world.getDimension("overworld")).runCommand(command));
            })
                .then((result) => {
                    return { error: false, ...result };
                })
                .catch((result) => {
                    return { error: true, successCount: 0, ...result };
                })
                .finally(() => this.commandQueue.splice(this.commandQueue.indexOf(promise), 1));
            this.commandQueue.push(promise);
            return promise;
        } catch (e) {
            if (typeof e == "string" && e.includes("queue")) {
                return (async () => {
                    await sleep(1);
                    return await this.queueCommand(command, target);
                })();
            } else {
                return Promise.resolve({ error: true, successCount: 0 });
            }
        }
    }

    /**
     * Flushes all pending commands in the current tick.
     * Any attempts at running commands while flushing will be queued.
     */
    async flushCommands() {
        if (this.commandQueue) return;
        this.flushingCommands = true;
        await Promise.all(this.commandQueue);
        this.flushingCommands = false;
    }
}
export const Server = new ServerBuilder();
