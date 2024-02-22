/**
 ** MIT License
 **
 ** Copyright (c) 2019 bitwkit
 **
 ** Permission is hereby granted, free of charge, to any person obtaining a copy
 ** of this software and associated documentation files (the "Software"), to deal
 ** in the Software without restriction, including without limitation the rights
 ** to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 ** copies of the Software, and to permit persons to whom the Software is
 ** furnished to do so, subject to the following conditions:
 **
 ** The above copyright notice and this permission notice shall be included in all
 ** copies or substantial portions of the Software.
 **
 ** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 ** IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 ** FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 ** AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 ** LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 ** OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 ** SOFTWARE.
 */

// Dependencies
import { TicksPerSecond } from "@minecraft/server";
import { setTickTimeout, clearTickTimeout } from "@notbeer-api";
import { EventEmitterTypes } from "library/@types/classes/eventEmitter";

// Auxiliary declarations

function* idGenerator(): Generator<number, number> {
    let id = 0;
    while (true) yield id++;
}

interface poolConfig<T extends PooledResource> {
  // required parameters:
  constructor: new (...args: unknown[]) => T /* reference to the constructor of pooled objects */
  arguments: unknown[] /* arguments for the pooled objects constructor */
  maxCount: number /* maximum number of objects in the pool */

  // optional:
  log?: (logLevel: number, ...args: unknown[]) => void /* function to which the resource pool object will pass log messages */
  requestTimeout?: number /* the request will be rejected if no resource is available within this period, ms */
  busyTimeout?: number /* if the resource is stuck in busy state for longer than this, it is deleted from the pool and its close method is being called, ms */
  idleTimeout?: number /* the resource is released from the pool and closed if it is not used for longer than this, ms */
}

interface PooledResource extends EventEmitterTypes {
  id: number
  close: () => void
}

const readyEventSym = Symbol("readyEventSym"); // reference to "ready" event emitted by resource
const errorEventSym = Symbol("errorEventSym"); // reference to "error" event emitted by resource

const DEFAULT_BUSY_TIMEOUT = TicksPerSecond * 60;
const DEFAULT_IDLE_TIMEOUT = TicksPerSecond * 60 * 60 * 24;
const DEFAULT_REQUEST_TIMEOUT = TicksPerSecond * 60;

// Main

class ResourcePool<T extends PooledResource> {
    private readonly config: poolConfig<T>;
    private readonly log: poolConfig<T>["log"];
    private readonly idleObjects: { obj: T, timeout: number }[] = [];
    private readonly busyObjects: { obj: T, timeout: number }[] = [];
    private readonly allocRequests: { resolve: (v: T) => void, rejectTimeout: number }[] = [];

    private readonly idGen = idGenerator();
    private processSheduleId: number;

    constructor(config: poolConfig<T>) {
        this.config = config;
        this.log = (logLevel, ...args) => (this.config?.log?.(logLevel, ...args));
    }

    private scheduleProcessing() {
        clearTickTimeout(this.processSheduleId);
        this.processSheduleId = setTickTimeout(() => this.processRequests());
    }

    private addToBusy(obj: T) {
        this.log(2, "add object", obj.constructor.name, ":", obj.id, "to busy pool");
        const timeout = setTickTimeout(() => {
            this.log(3, "busy timeout reached for object", obj.constructor.name, ":", obj.id);
            this.errorCallback(obj);
            this.scheduleProcessing();
        }, this.config.busyTimeout ?? DEFAULT_BUSY_TIMEOUT);
        this.busyObjects.push({ obj, timeout });
    }

    private addToIdle(obj: T) {
        this.log(2, "add object", obj.constructor.name, ":", obj.id, "to idle pool");
        const timeout = setTickTimeout(() => {
            this.log(3, "idle timeout reached for object", obj.constructor.name, ":", obj.id);
            this.removeObject(obj);
            this.scheduleProcessing(); // processing is likely not needed in this case
        }, this.config.idleTimeout ?? DEFAULT_IDLE_TIMEOUT);
        this.idleObjects.unshift({ obj, timeout });
    }

    private deleteFromBusy(obj: T) {
        const index = this.busyObjects.findIndex(elem => elem.obj === obj);
        if (index >= 0) {
            this.log(2, "delete object", obj.constructor.name, ":", obj.id, "from busy pool");
            clearTickTimeout(this.busyObjects[index].timeout);
            this.busyObjects.splice(index, 1);
            return true;
        }
        return false;
    }

    private deleteFromIdle(obj: T) {
        const index = this.idleObjects.findIndex(elem => elem.obj === obj);
        if (index >= 0) {
            this.log(2, "delete object", obj.constructor.name, ":", obj.id, "from idle pool");
            clearTickTimeout(this.idleObjects[index].timeout);
            this.idleObjects.splice(index, 1);
            return true;
        }
        return false;
    }

    private readyCallback(obj: T) {
        this.log(1, "ready callback for object", obj.constructor.name, ":", obj.id);
        this.deleteFromBusy(obj);
        this.addToIdle(obj);
    }

    private errorCallback(obj: T) {
        this.log(0, "error callback for object", obj.constructor.name, ":", obj.id);
        try {
            obj.close();
        } catch (err) {
            this.log(0, "error calling resource close method:", err);
        }

        this.deleteFromBusy(obj);
        this.deleteFromIdle(obj);

        obj.removeAllListeners(readyEventSym);
        obj.removeAllListeners(errorEventSym);
    }

    private addObject() {
        const obj = new this.config.constructor(...this.config.arguments);
        obj.id = this.idGen.next().value; // add id to the object
        this.log(1, "new resource object", obj.constructor.name, ":", obj.id);

        this.addToIdle(obj);

        obj.once(errorEventSym, () => {
            this.errorCallback(obj);
            this.scheduleProcessing();
        });

        obj.on(readyEventSym, () => {
            this.readyCallback(obj);
            this.scheduleProcessing();
        });
    }

    private removeObject(obj: T) {
        this.log(1, "removing object:", obj.constructor.name, ":", obj.id);
        try {
            obj.close();
        } catch (err) {
            this.log(0, "error calling resource close method:", err);
        }

        this.deleteFromBusy(obj);
        this.deleteFromIdle(obj);

        obj.removeAllListeners(readyEventSym);
        obj.removeAllListeners(errorEventSym);
    }

    private deleteRequest(request: typeof this.allocRequests[number])  {
        const index = this.allocRequests.indexOf(request);
        if (index >= 0) {
            this.allocRequests.splice(index, 1);
            return true;
        }
        return false;
    }

    // TODO: Remove promises
    allocate() {
        this.log(2, "allocating new resource request");
        return new Promise<T>((resolve, reject) => {
            const request = {
                resolve,
                rejectTimeout: setTickTimeout(() => {
                    // remove request from the array and reject it on timeout
                    this.log(0, "request rejected on timeout");
                    this.deleteRequest(request);
                    reject();
                }, this.config.requestTimeout || DEFAULT_REQUEST_TIMEOUT)
            };
            this.allocRequests.push(request);
            this.scheduleProcessing();
        });
    }

    private processRequests() {
        this.log(2, "started request processing");

        // assign pending requests to idle resources if possible
        while ((this.allocRequests.length > 0) && (this.idleObjects.length > 0)) {
            const allocateRequest = this.allocRequests.shift();
            const obj = this.idleObjects[0].obj;
            this.deleteFromIdle(obj);
            this.addToBusy(obj);
            clearTickTimeout(allocateRequest.rejectTimeout);
            allocateRequest.resolve(obj);
            this.log(1, "allocated request to idle resource", obj.constructor.name, ":", obj.id);
        }

        // create new resources if possible for unprocessed requests
        let toAdd = Math.min(this.config.maxCount - this.busyObjects.length, this.allocRequests.length);
        const createdObjects = !!toAdd;
        while (toAdd > 0) {
            this.log(2, "creating new object");
            this.addObject();
            toAdd--;
        }

        this.log(2, "ended request processing");
        if (createdObjects) {
            this.scheduleProcessing();
        }
    }
}

// Exports

export { ResourcePool, PooledResource, poolConfig, readyEventSym, errorEventSym };
