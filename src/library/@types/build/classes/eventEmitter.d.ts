import { EventList } from "../Events";

export interface EventEmitterConstructor {
    new(): EventEmitterTypes;
}
export interface EventEmitterTypes {
  /**
   * Listen for an event
   * @param eventName Event you want to listen for
   * @param listener Function you want to execute
   * @alias emitter.on()
   */
   addListener<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   addListener<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Emit data for an event type
    * @param eventName Event you are firing
    * @param args Event data you are sending
    */
   emit<K extends keyof EventList>(eventName: K, ...args: EventList[K]): boolean;
   emit<S extends string | symbol>(eventName: Exclude<S, keyof EventList>, ...args: any[]): boolean;
   
   eventNames(): Array<String>;
 
   getMaxListeners(): Number;
 
   /**
    * Get count of event(s)
    * @param eventName Event name you want to find the count for
    */
   listenerCount<K extends keyof EventList>(eventName?: K): number;
   listenerCount<S extends string | symbol>(eventName?: Exclude<S, keyof EventList>): number;
 
   /**
    * All event functions that are listening
    * @param eventName Event name you want to find all the listeners on
    */
   listeners<K extends keyof EventList>(eventName: K): Array<Function>;
   listeners<S extends string | symbol>(eventName: Exclude<S, keyof EventList>): Array<Function>;
 
   /**
    * Turn off an event
    * @param eventName Event you want to stop listening for
    * @param listener Function that is being called
    */
   off<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   off<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
   
   /**
    * Listen for an event
    * @param eventName Event you want to listen for
    * @param listener Function you want to execute
    */
   on<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   on<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Listen for an event, ONCE
    * @param eventName Event you want to listen for
    * @param listener Function you want to execute
    */
   once<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   once<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Listen for an event. This will execute the listener before any other previous ones
    * @param eventName Event you want to listen for
    * @param listener Function you want to execute
    */
   prependListener<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   prependListener<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Listen for an event, ONCE. This will execute the listener before any other previous ones
    * @param eventName Event you want to listen for only ONCE
    * @param listener Function you want to execute
    */
   prependOnceListener<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   prependOnceListener<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Remove type of listeners
    * @param eventName Listener to remove
    */
   removeAllListeners(eventName?: string): void;
 
   /**
    * Turn off an event
    * @param eventName Event you want to stop listening for
    * @param listener Function that is being called
    * @alias emitter.off()
    */
   removeListener<K extends keyof EventList>(eventName: K, listener: (...args: EventList[K]) => void): this;
   removeListener<S extends string | symbol>(
     eventName: Exclude<S, keyof EventList>,
     listener: (...args: any[]) => void,
   ): this;
 
   /**
    * Increase or decrease listener count
    * @param number New max listener count
    */
   setMaxListeners(number: number): void;
 
   /**
    * All event functions
    * @param eventName Event name you want to find all the listeners on, including emitter.once()
    */
   rawListeners<K extends keyof EventList>(eventName: K): Array<Function>;
   rawListeners<S extends string | symbol>(eventName: Exclude<S, keyof EventList>): Array<Function>;
}
