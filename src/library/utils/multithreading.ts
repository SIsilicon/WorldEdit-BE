import { configuration } from "../build/configurations.js";
import { world } from "mojang-minecraft";
import { contentLog } from "./contentlog.js";

const threads: Thread[] = [];

class Thread {
    private task: Generator<void, any>

    private active = false;
    private valid = true;

    start(task: (...args: any[]) => Generator<void, any>, ...args: any[]) {
        if (!this.valid) {
            return;
        }

        this.task = task(...args);
        threads.unshift(this);
        if (!subscribed) {
            subscribed = true;
            world.events.tick.subscribe(listener)
        }
        this.active = true;
        this.valid = false;

        if (!configuration.multiThreadingEnabled) {
            this.join();
        }
    }

    join() {
        if (this.valid || !this.active) {
            return;
        }

        if (threads.includes(this)) {
            threads.splice(threads.indexOf(this), 1);
        }
        if (subscribed && threads.length === 0) {
            subscribed = false;
            world.events.tick.unsubscribe(listener);
        }
        this.active = false;
        
        while (!this.task.next().done) {
            continue;
        }
    }

    /**
     * @internal
     * @returns The generator task
     */
    getTask() {
        return this.task;
    }

    isActive() {
        return this.active;
    }
}

let subscribed = false;
const listener = function() {
    const ms = Date.now();
    while (Date.now() - ms < configuration.multiThreadingTimeBudget && threads.length) {
        const thread = threads.pop();
        try {
            if (thread.getTask().next().done) {
                thread.join();
                continue;
            }
            threads.unshift(thread);
        } catch (e) {
            contentLog.error(e);
            thread.join();
        }
    }
};

let iterCount: number = 0;
function iterateChunk() {
    if (iterCount++ > 16) {
        iterCount = 0;
        return true;
    } else {
        return false;
    }
}

export { Thread, iterateChunk };