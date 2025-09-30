/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EventEmitterTypes<T extends { [K in keyof T]: unknown[] }> {
    /**
     * Listen for an event
     * @param eventName Event you want to listen for
     * @param listener Function you want to execute
     * @alias emitter.on()
     */
    addListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    shutdown(): this;

    /**
     * Emit data for an event type
     * @param eventName Event you are firing
     * @param args Event data you are sending
     */
    emit<K extends keyof T>(eventName: K, ...args: T[K]): boolean;

    eventNames(): Array<string>;

    getMaxListeners(): number;

    /**
     * Get count of event(s)
     * @param eventName Event name you want to find the count for
     */
    listenerCount<K extends keyof T>(eventName?: K): number;

    /**
     * All event functions that are listening
     * @param eventName Event name you want to find all the listeners on
     */
    listeners<K extends keyof T>(eventName: K): Array<Function>;

    /**
     * Turn off an event
     * @param eventName Event you want to stop listening for
     * @param listener Function that is being called
     */
    off<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Listen for an event
     * @param eventName Event you want to listen for
     * @param listener Function you want to execute
     */
    on<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Listen for an event, ONCE
     * @param eventName Event you want to listen for
     * @param listener Function you want to execute
     */
    once<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Listen for an event. This will execute the listener before any other previous ones
     * @param eventName Event you want to listen for
     * @param listener Function you want to execute
     */
    prependListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Listen for an event, ONCE. This will execute the listener before any other previous ones
     * @param eventName Event you want to listen for only ONCE
     * @param listener Function you want to execute
     */
    prependOnceListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Remove type of listeners
     * @param eventName Listener to remove
     */
    removeAllListeners<K extends keyof T>(eventName?: K): void;

    /**
     * Turn off an event
     * @param eventName Event you want to stop listening for
     * @param listener Function that is being called
     * @alias emitter.off()
     */
    removeListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this;

    /**
     * Increase or decrease listener count
     * @param number New max listener count
     */
    setMaxListeners(number: number): void;

    /**
     * All event functions
     * @param eventName Event name you want to find all the listeners on, including emitter.once()
     */
    rawListeners<K extends keyof T>(eventName: K): Array<Function>;
}
