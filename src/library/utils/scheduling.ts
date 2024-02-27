/* eslint-disable @typescript-eslint/ban-types */
import { system } from "@minecraft/server";

const tickTimeoutMap = new Map();
const tickIntervalMap = new Map();
let tickTimeoutID = 0,
    tickIntervalID = 0;

/**
 * Delay executing a function
 * @typedef
 * @param {string | Function} handler Function you want to execute
 * @param {number} [timeout] Time delay in ticks. 20 ticks is 1 second
 * @param {any[]} args Function parameters for your handler
 * @returns {number}
 */
function setTickTimeout(handler: string | Function, timeout = 1, ...args: unknown[]): number {
    const tickTimeout = { callback: handler, tick: timeout, args };
    tickTimeoutID++;
    tickTimeoutMap.set(tickTimeoutID, tickTimeout);
    return tickTimeoutID;
}
/**
 * Delay executing a function, REPEATEDLY
 * @typedef
 * @param {string | Function} handler Function you want to execute
 * @param {number} [timeout] Time delay in ticks. 20 ticks is 1 second
 * @param {any[]} args Function parameters for your handler
 * @returns {number}
 */
function setTickInterval(handler: string | Function, timeout = 1, ...args: unknown[]): number {
    const tickInterval = { callback: handler, tick: timeout, args };
    tickIntervalID++;
    tickIntervalMap.set(tickIntervalID, tickInterval);
    return tickIntervalID;
}
/**
 * Delete a clearTickTimeout
 * @typedef
 * @param {number} handle Index you want to delete
 */
function clearTickTimeout(handle: number): void {
    tickTimeoutMap.delete(handle);
}
/**
 * Delete a clearTickInterval
 * @typedef
 * @param {number} handle Index you want to delete
 */
function clearTickInterval(handle: number): void {
    tickIntervalMap.delete(handle);
}

let totalTick = 0;
system.runInterval(() => {
    totalTick++;
    for (const [ID, tickTimeout] of tickTimeoutMap) {
        tickTimeout.tick--;
        if (tickTimeout.tick <= 0) {
            tickTimeout.callback(...tickTimeout.args);
            tickTimeoutMap.delete(ID);
        }
    }
    for (const [, tickInterval] of tickIntervalMap) {
        if (totalTick % tickInterval.tick === 0) tickInterval.callback(...tickInterval.args);
    }
});

function sleep(ticks: number) {
    return new Promise((resolve) => setTickTimeout(resolve, ticks));
}

function shutdownTimers() {
    tickTimeoutMap.clear();
    tickIntervalMap.clear();
}

class Timer {
    private time = Date.now();
    private isActive = false;

    start() {
        if (!this.isActive) {
            this.time = Date.now();
            this.isActive = true;
        }
    }

    getTime() {
        if (this.isActive) {
            return Date.now() - this.time;
        }
    }

    end() {
        if (this.isActive) {
            this.isActive = false;
            return Date.now() - this.time;
        }
    }
}

/**
 * Creates a timer and starts it.
 */
function startTime() {
    const timer = new Timer();
    timer.start();
    return timer;
}

export { setTickTimeout, setTickInterval, clearTickTimeout, clearTickInterval, shutdownTimers, sleep, startTime, Timer };
