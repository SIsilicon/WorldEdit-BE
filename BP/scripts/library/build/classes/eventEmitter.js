export const EventEmitter = class Class {
    constructor() {
        this._listeners = [];
        this._configurations = {
            maxListeners: 10
        };
    }
    /**
     * @private
     * @param {string} eventName Event type to listen for
     * @param {Function} listener Function to callback on fire
     * @param {boolean} [once] Wheather to listen for the event only ONCE or not
     * @param {boolean} [prepand] Insert the Event in the beginning of the Array, so it executes first
     */
    _addListener(eventName, listener, once, prepand) {
        const listenerCount = this.listenerCount(eventName);
        if (listenerCount >= this._configurations.maxListeners)
            throw `Warning: Possible EventEmitter memory leak detected. ${listenerCount + 1} ${eventName} listeners added. Use emitter.setMaxListeners(n) to increase limit`;
        const data = {
            eventName,
            listener,
            once,
            executed: false
        };
        if (prepand)
            this._listeners.unshift(data);
        else
            this._listeners.push(data);
    }
    ;
    /**
     * @private
     * @param {string} eventName Event type to remove
     * @param {Function} listener Function that is being called
     */
    _removeListener(eventName, listener) {
        if (typeof listener === 'number')
            this._listeners.splice(listener, 1);
        const index = this._listeners.findIndex(v => v.eventName === eventName && v.listener === listener);
        if (index !== -1)
            this._listeners.splice(index, 1);
    }
    ;
    addListener(eventName, listener) {
        this._addListener(eventName, listener, false);
        return this;
    }
    ;
    emit(eventName, ...args) {
        let status = false;
        this._listeners.forEach(object => {
            if (object.eventName === eventName) {
                if (object.once && object.executed)
                    return;
                object.listener(...args);
                status = true, object.executed = true;
            }
            ;
        });
        return status;
    }
    ;
    eventNames() {
        return this._listeners.map(v => v.eventName);
    }
    ;
    getMaxListeners() {
        return this._configurations?.maxListeners;
    }
    ;
    listenerCount(eventName) {
        return eventName ? this._listeners.filter(v => v.eventName === eventName).length : this._listeners.length;
    }
    ;
    listeners(eventName) {
        const Functions = [];
        this._listeners.forEach(object => {
            if (object.eventName === eventName && !object.once)
                Functions.push(object.listener);
        });
        return Functions;
    }
    ;
    off(eventName, listener) {
        this._removeListener(eventName, listener);
        return this;
    }
    ;
    on(eventName, listener) {
        this._addListener(eventName, listener, false);
        return this;
    }
    ;
    once(eventName, listener) {
        this._addListener(eventName, listener, true);
        return this;
    }
    ;
    prependListener(eventName, listener) {
        this._addListener(eventName, listener, false, true);
        return this;
    }
    ;
    prependOnceListener(eventName, listener) {
        this._addListener(eventName, listener, true, true);
        return this;
    }
    ;
    removeAllListeners(eventName) {
        eventName ? this._listeners = this._listeners.filter(element => element.eventName !== eventName) : this._listeners = [];
    }
    ;
    removeListener(eventName, listener) {
        this._removeListener(eventName, listener);
        return this;
    }
    ;
    setMaxListeners(number) {
        if (typeof number === 'number')
            this._configurations.maxListeners = number;
    }
    ;
    rawListeners(eventName) {
        const Functions = [];
        this._listeners.forEach(object => {
            if (object.eventName === eventName)
                Functions.push(object.listener);
        });
        return Functions;
    }
    ;
};
