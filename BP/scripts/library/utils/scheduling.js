import { World } from 'mojang-minecraft';
const tickTimeoutMap = new Map();
const tickIntervalMap = new Map();
let tickTimeoutID = 0, tickIntervalID = 0;
/**
 * Delay executing a function
 * @typedef
 * @param {string | Function} handler Function you want to execute
 * @param {number} [timeout] Time delay in ticks. 20 ticks is 1 second
 * @param {any[]} args Function parameters for your handler
 * @returns {number}
 */
function setTickTimeout(handler, timeout, ...args) {
    const tickTimeout = { callback: handler, tick: timeout, args };
    tickTimeoutID++;
    tickTimeoutMap.set(tickTimeoutID, tickTimeout);
    return tickTimeoutID;
}
;
/**
 * Delay executing a function, REPEATEDLY
 * @typedef
 * @param {string | Function} handler Function you want to execute
 * @param {number} [timeout] Time delay in ticks. 20 ticks is 1 second
 * @param {any[]} args Function parameters for your handler
 * @returns {number}
 */
function setTickInterval(handler, timeout, ...args) {
    const tickInterval = { callback: handler, tick: timeout, args };
    tickIntervalID++;
    tickIntervalMap.set(tickIntervalID, tickInterval);
    return tickIntervalID;
}
;
/**
 * Delete a clearTickTimeout
 * @typedef
 * @param {number} handle Index you want to delete
 */
function clearTickTimeout(handle) {
    tickTimeoutMap.delete(handle);
}
;
/**
 * Delete a clearTickInterval
 * @typedef
 * @param {number} handle Index you want to delete
 */
function clearTickInterval(handle) {
    tickIntervalMap.delete(handle);
}
;
let totalTick = 0;
World.events.tick.subscribe(() => {
    totalTick++;
    for (const [ID, tickTimeout] of tickTimeoutMap) {
        tickTimeout.tick--;
        if (tickTimeout.tick <= 0) {
            tickTimeout.callback(...tickTimeout.args);
            tickTimeoutMap.delete(ID);
        }
        ;
    }
    ;
    for (const [, tickInterval] of tickIntervalMap) {
        if (totalTick % tickInterval.tick === 0)
            tickInterval.callback(...tickInterval.args);
    }
    ;
});
export { setTickTimeout, setTickInterval, clearTickTimeout, clearTickInterval };
