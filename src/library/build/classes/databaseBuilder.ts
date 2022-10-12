/* eslint-disable @typescript-eslint/no-explicit-any */
import { world, ScoreboardObjective } from "@minecraft/server";
import { Server } from "../classes/serverBuilder.js";

let objective: ScoreboardObjective;
try {
  objective = world.scoreboard.getObjective("GAMETEST_DB");
} catch {
  objective = world.scoreboard.addObjective("GAMETEST_DB", "");
}

export class Database {
  private data: {[key: string]: any} = null;
  private opened = false;

  constructor(private name: string) {}

  /**
  * Save a value or update a value in the Database under a key
  * @param {string} Key The key you want to save the value as
  * @param {any} value The value you want to save
  * @example Database.set('Test Key', 'Test Value');
  */
  set(key: string, value: any): void {
    this.data[key] = value;
  }
  /**
  * Get the value of the key
  * @param {string} key
  * @returns {any}
  * @example Database.get('Test Key');
  */
  get(key: string): any {
    return this.data[key];
  }
  /**
  * Check if the key exists in the table
  * @param {string} key
  * @returns {boolean}
  * @example Database.has('Test Key');
  */
  has(key: string): boolean {
    return key in this.data;
  }
  /**
  * Delete the key from the table
  * @param {string} key
  * @returns {boolean}
  * @example Database.delete('Test Key');
  */
  delete(key: string): void {
    delete this.data[key];
  }
  /**
  * Clear everything in the table
  * @example Database.clear()
  */
  clear(): void {
    this.data = {};
  }
  /**
   * Load the table from the scoreboard data.
   * @example Database.load()
   */
  load(): void {
    for (const table of objective.getParticipants()) {
      const name = table.displayName;
      if (name.startsWith(`{"DB_TABLE":"${this.name}"`)) {
        this.data = JSON.parse(name);
        return;
      }
    }
    this.data = {};
    this.opened = true;
  }
  /**
   * Save all changes to the table.
   * @example Database.save()
   */
  save(): void {
    Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(this.data))} GAMETEST_DB 0`);
  }
  /**
  * Get all the keys in the table
  * @returns {Array<string>}
  * @example Database.keys();
  */
  keys(): Array<string> {
    return Object.keys(this.data);
  }
  /**
  * Get all the values in the table
  * @returns {Array<any>}
  * @example Database.values();
  */
  values(): Array<any> {
    return Object.values(this.data);
  }
  /**
  * Check if all the keys exists in the table
  * @param {string} keys
  * @returns {boolean}
  * @example Database.hasAll('Test Key', 'Test Key 2', 'Test Key 3');
  */
  hasAll(...keys: Array<string>): boolean {
    return keys.every((k) => this.has(k));
  }
  /**
  * Check if any of the keys exists in the table
  * @param {string} keys
  * @returns {boolean}
  * @example Database.hasAny('Test Key', 'Test Key 2', 'Test Key 3');
  */
  hasAny(...keys: Array<string>): boolean {
    return keys.some((k) => this.has(k));
  }
  /**
  * Get all the key(s) from the beginning of the table
  * @param {number} [amount]
  * @returns {Array<string>}
  * @example Database.firstKey(2);
  */
  firstKey(amount?: number): Array<string> {
    const keys = this.keys();
    if(typeof amount !== "number") return [keys[0]];
    if(!amount) return [];
    if(amount < 0) return this.lastKey(amount * -1);
    return keys.slice(0, amount);
  }
  /**
  * Get all the values(s) from the beginning of the table
  * @param {number} [amount]
  * @returns {Array<any>}
  * @example Database.firstValue(2);
  */
  firstValue(amount?: number): Array<any> {
    const values = this.values();
    if(typeof amount !== "number") return [values[0]];
    if(!amount) return [];
    if(amount < 0) return this.lastValue(amount * -1);
    return values.slice(0, amount);
  }
  /**
  * Get all the key(s) from the end of the table
  * @param {number} [amount]
  * @returns {Array<string>}
  * @example Database.lastKey();
  */
  lastKey(amount?: number): Array<string> {
    const keys = this.keys();
    if(typeof amount !== "number") return [keys[keys.length - 1]];
    if(!amount) return [];
    if(amount < 0) return this.firstKey(amount * -1);
    return keys.slice(-amount).reverse();
  }
  /**
  * Get all the values(s) from the end of the table
  * @param {number} [amount]
  * @returns {Array<any>}
  * @example Database.lastValue();
  */
  lastValue(amount?: number): Array<any> {
    const values = this.values();
    if(typeof amount !== "number") return [values[values.length - 1]];
    if(!amount) return [];
    if(amount < 0) return this.firstValue(amount * -1);
    return values.slice(-amount).reverse();
  }
  /**
  * Get random key(s)
  * @param {number} amount
  * @returns {Array<string>}
  * @example Database.randomKey(3);
  */
  randomKey(amount?: number): Array<string> {
    const keys = this.keys();
    return keys.sort(() => Math.random() - Math.random()).slice(0, Math.abs(amount));
  }
  /**
  * Get random value(s)
  * @param {number} amount
  * @returns {Array<string>}
  * @example Database.randomValue(3);
  */
  randomValue(amount?: number): Array<string> {
    const values = this.values();
    return values.sort(() => Math.random() - Math.random()).slice(0, Math.abs(amount));
  }
}

