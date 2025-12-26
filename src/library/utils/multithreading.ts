import { configuration } from "../configurations.js";
import { system } from "@minecraft/server";
import { contentLog } from "./contentlog.js";
import { setTickTimeout, sleep } from "./scheduling.js";

let threadId = 1;

const threads: Thread[] = [];
const tasks = new WeakMap<Thread, Generator>();
const promises = new WeakMap<Thread, unknown>();
const waitForPromise = { waitingForPromise: true } as const;

class ErrorPackage {
    constructor(public err: unknown) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Thread<T extends any[] = any[]> {
    public readonly id: number;

    private active = false;
    private valid = true;

    constructor() {
        this.id = ++threadId;
    }

    get isActive() {
        return this.active;
    }

    get isValid() {
        return this.active;
    }

    start(task: (...args: T) => Generator<unknown>, ...args: T) {
        if (!this.valid) {
            return;
        }

        tasks.set(this, task(...args));
        threads.unshift(this);
        this.active = true;
        this.valid = false;

        if (!configuration.multiThreadingEnabled) this.join();
    }

    async join() {
        if (this.valid || !this.active) return;

        if (threads.includes(this)) threads.splice(threads.indexOf(this), 1);
        this.active = false;

        while (Object.is(promises.get(this), waitForPromise)) await sleep(1);

        let promiseRes = promises.get(this);
        const task = tasks.get(this);
        promises.delete(this);
        let next = promiseRes instanceof ErrorPackage ? task.throw(promiseRes.err) : task.next(promiseRes);
        while (!next.done) {
            if (next.value instanceof Promise) {
                try {
                    promiseRes = await next.value;
                } catch (err) {
                    promiseRes = new ErrorPackage(err);
                }
            }
            next = promiseRes instanceof ErrorPackage ? task.throw(promiseRes.err) : task.next(promiseRes);
            promiseRes = undefined;
        }
    }

    abort() {
        if (this.valid || !this.active) return;
        if (threads.includes(this)) threads.splice(threads.indexOf(this), 1);
        promises.delete(this);
        this.active = false;
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
        const task = tasks.get(thread);
        currentThread = thread;
        try {
            const promiseRes = promises.get(thread);
            if (Object.is(promiseRes, waitForPromise)) {
                setTickTimeout(() => threads.unshift(thread));
                continue;
            }
            promises.delete(thread);
            const next = promiseRes instanceof ErrorPackage ? task.throw(promiseRes.err) : task.next(promiseRes);
            if (next.done) {
                thread.join();
                continue;
            } else if (next.value instanceof Promise) {
                promises.set(thread, waitForPromise);
                next.value.then((result) => promises.set(thread, result)).catch((err) => promises.set(thread, new ErrorPackage(err)));
            }
            threads.unshift(thread);
        } catch (e) {
            contentLog.error(e);
            task.throw(e);
            thread.join();
        }
        currentThread = undefined;
    }
});

let iterCount = 0;
function* iterateChunk<T>(val: T) {
    if (iterCount++ > 16) {
        iterCount = 0;
        yield val;
    }
}

function getCurrentThread() {
    return currentThread;
}

function shutdownThreads() {
    threads.length = 0;
}

export { Thread, iterateChunk, getCurrentThread, shutdownThreads };
