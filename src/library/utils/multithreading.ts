import { configuration } from "../configurations.js";
import { system } from "@minecraft/server";
import { contentLog } from "./contentlog.js";
import { setTickTimeout, sleep } from "./scheduling.js";

let threadId = 1;

const threads: Thread[] = [];
const promiseData = new Map<Thread, unknown>();
const waitForPromise = { waitingForPromise: true } as const;

class ErrorPackage {
    constructor(public err: unknown) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Thread<T extends any[] = any[]> {
    public readonly id: number;

    private task: Generator<unknown>;
    private active = false;
    private valid = true;

    constructor() {
        this.id = ++threadId;
    }

    start(task: (...args: T) => Generator<unknown>, ...args: T) {
        if (!this.valid) {
            return;
        }

        this.task = task(...args);
        threads.unshift(this);
        this.active = true;
        this.valid = false;

        if (!configuration.multiThreadingEnabled) this.join();
    }

    async join() {
        if (this.valid || !this.active) return;

        if (threads.includes(this)) threads.splice(threads.indexOf(this), 1);
        this.active = false;

        while (Object.is(promiseData.get(this), waitForPromise)) await sleep(1);

        let promiseRes = promiseData.get(this);
        promiseData.delete(this);
        let next = promiseRes instanceof ErrorPackage ? this.task.throw(promiseRes.err) : this.task.next(promiseRes);
        while (!next.done) {
            if (next.value instanceof Promise) {
                try {
                    promiseRes = await next.value;
                } catch (err) {
                    promiseRes = new ErrorPackage(err);
                }
            }
            next = promiseRes instanceof ErrorPackage ? this.task.throw(promiseRes.err) : this.task.next(promiseRes);
            promiseRes = undefined;
        }
    }

    abort() {
        if (this.valid || !this.active) return;
        if (threads.includes(this)) threads.splice(threads.indexOf(this), 1);
        promiseData.delete(this);
        this.active = false;
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

    toString() {
        return `[thread #${this.id}]`;
    }
}

let currentThread: Thread = undefined;
system.runInterval(() => {
    const ms = Date.now();
    while (Date.now() - ms < configuration.multiThreadingTimeBudget && threads.length) {
        const thread = threads.pop();
        currentThread = thread;
        try {
            const promiseRes = promiseData.get(thread);
            if (Object.is(promiseRes, waitForPromise)) {
                setTickTimeout(() => threads.unshift(thread));
                continue;
            }
            promiseData.delete(thread);
            const next = promiseRes instanceof ErrorPackage ? thread.getTask().throw(promiseRes.err) : thread.getTask().next(promiseRes);
            if (next.done) {
                thread.join();
                continue;
            } else if (next.value instanceof Promise) {
                promiseData.set(thread, waitForPromise);
                next.value.then((result) => promiseData.set(thread, result)).catch((err) => promiseData.set(thread, new ErrorPackage(err)));
            }
            threads.unshift(thread);
        } catch (e) {
            contentLog.error(e);
            thread.getTask().throw(e);
            thread.join();
        }
        currentThread = undefined;
    }
});

let iterCount = 0;
function iterateChunk() {
    if (iterCount++ > 16) {
        iterCount = 0;
        return true;
    } else {
        return false;
    }
}

function getCurrentThread() {
    return currentThread;
}

function shutdownThreads() {
    threads.length = 0;
}

export { Thread, iterateChunk, getCurrentThread, shutdownThreads };
