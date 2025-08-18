/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitterTypes } from "../@types/classes/eventEmitter";

export class EventEmitter<T extends { [K in keyof T]: any[] }> implements EventEmitterTypes<T> {
    private _listeners: any[] = [];
    private _configurations = {
        maxListeners: 10,
    };

    /**
     * @private
     * @param {any} eventName Event type to listen for
     * @param {Function} listener Function to callback on fire
     * @param {boolean} [once] Whether to listen for the event only ONCE or not
     * @param {boolean} [prepend] Insert the Event in the beginning of the Array, so it executes first
     */
    private _addListener(eventName: any, listener: (...args: any[]) => void, once?: boolean, prepend?: boolean): void {
        const listenerCount = this.listenerCount(eventName);
        if (listenerCount >= this._configurations.maxListeners)
            throw `Warning: Possible EventEmitter memory leak detected. ${listenerCount + 1} ${eventName} listeners added. Use emitter.setMaxListeners(n) to increase limit`;
        const data = {
            eventName,
            listener,
            once,
            executed: false,
        };
        if (prepend) this._listeners.unshift(data);
        else this._listeners.push(data);
    }

    /**
     * @private
     * @param {string} eventName Event type to remove
     * @param {Function} listener Function that is being called
     */
    private _removeListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): void {
        if (typeof listener === "number") this._listeners.splice(listener, 1);
        const index = this._listeners.findIndex((v) => v.eventName === eventName && v.listener === listener);
        if (index !== -1) this._listeners.splice(index, 1);
    }

    addListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._addListener(eventName, listener, false);
        return this;
    }

    shutdown(): this {
        this._listeners.length = 0;
        return this;
    }

    emit<K extends keyof T>(eventName: K, ...args: T[K]): boolean {
        let status = false;
        this._listeners.forEach((object) => {
            if (object.eventName === eventName) {
                if (object.once && object.executed) return;
                object.listener(...args);
                (status = true), (object.executed = true);
            }
        });
        return status;
    }

    eventNames(): Array<string> {
        return this._listeners.map((v) => v.eventName);
    }

    getMaxListeners(): number {
        return this._configurations?.maxListeners;
    }

    listenerCount<K extends keyof T>(eventName: K): number {
        return eventName ? this._listeners.filter((v) => v.eventName === eventName).length : this._listeners.length;
    }

    listeners<K extends keyof T>(eventName: K): Array<Function> {
        const Functions: Array<Function> = [];
        this._listeners.forEach((object) => {
            if (object.eventName === eventName && !object.once) Functions.push(object.listener);
        });
        return Functions;
    }

    off<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._removeListener(eventName, listener);
        return this;
    }

    on<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._addListener(eventName, listener, false);
        return this;
    }

    once<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._addListener(eventName, listener, true);
        return this;
    }

    prependListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._addListener(eventName, listener, false, true);
        return this;
    }

    prependOnceListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._addListener(eventName, listener, true, true);
        return this;
    }

    removeAllListeners<K extends keyof T>(eventName: K): void {
        eventName ? (this._listeners = this._listeners.filter((element) => element.eventName !== eventName)) : (this._listeners = []);
    }

    removeListener<K extends keyof T>(eventName: K, listener: (...args: T[K]) => void): this {
        this._removeListener(eventName, listener);
        return this;
    }

    setMaxListeners(number: number): void {
        if (typeof number === "number") this._configurations.maxListeners = number;
    }

    rawListeners<K extends keyof T>(eventName: K): Array<Function> {
        const Functions: Array<Function> = [];
        this._listeners.forEach((object) => {
            if (object.eventName === eventName) Functions.push(object.listener);
        });
        return Functions;
    }
}
