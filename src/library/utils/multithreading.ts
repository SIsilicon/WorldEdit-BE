import { configuration } from "../build/configurations.js";
import { world } from "@minecraft/server";
import { contentLog } from "./contentlog.js";

const threads: Thread<unknown[]>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Thread<T extends any[]> {
  private task: Generator<void>;

  private active = false;
  private valid = true;

  start(task: (...args: T) => Generator<void>, ...args: T) {
    if (!this.valid) {
      return;
    }

    this.task = task(...args);
    threads.unshift(this);
    if (!subscribed) {
      subscribed = true;
      world.events.tick.subscribe(listener);
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

let iterCount = 0;
function iterateChunk() {
  if (iterCount++ > 16) {
    iterCount = 0;
    return true;
  } else {
    return false;
  }
}

function shutdownThreads() {
  threads.length = 0;
  world.events.tick.unsubscribe(listener);
}

export { Thread, iterateChunk, shutdownThreads };