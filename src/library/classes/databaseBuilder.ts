/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, World, world } from "@minecraft/server";
import { Server } from "./serverBuilder.js";

const objective = world.scoreboard.getObjective("GAMETEST_DB") ?? world.scoreboard.addObjective("GAMETEST_DB", "");

export class Database<T extends {} = { [key: string]: any }> {
    private data: T;
    private provider: World | Entity;

    constructor(
        private name: string,
        provider: World | Entity = world,
        reviver?: (key: string, value: any) => any
    ) {
        if (this.provider instanceof Entity) this.name += this.provider.id;

        const table = this.getScoreboardParticipant();
        this.data = table ? JSON.parse(JSON.parse(`"${table.displayName}"`), reviver)[1] : {};
        this.provider = provider;
    }

    /**
     * Save a value or update a value in the Database under a key
     * @param key The key you want to save the value as
     * @param value The value you want to save
     * @example Database.set('Test Key', 'Test Value');
     */
    set(key: keyof T, value: T[typeof key]): void {
        this.data[key] = value;
    }
    /**
     * Get the value of the key
     * @param key
     * @returns value
     * @example Database.get('Test Key');
     */
    get(key: keyof T): T[typeof key] {
        return this.data[key];
    }
    /**
     * Check if the key exists in the table
     * @param key
     * @returns Whether the key exists
     * @example Database.has('Test Key');
     */
    has(key: keyof T): boolean {
        return key in this.data;
    }
    /**
     * Delete the key from the table
     * @param key
     * @example Database.delete('Test Key');
     */
    delete(key: keyof T): void {
        delete this.data[key];
    }
    /**
     * Clear everything in the table
     * @example Database.clear()
     */
    clear(): void {
        this.data = {} as T;
    }
    /**
     * Save all changes to the scoreboard.
     * @example Database.save()
     */
    save(): void {
        const table = this.getScoreboardParticipant();
        if (table) Server.runCommand(`scoreboard players reset "${table.displayName}" GAMETEST_DB`);
        Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify(["wedit:" + this.name, this.data]))} GAMETEST_DB 0`);
    }
    /**
     * Get all the keys in the table
     * @returns Array of keys
     * @example Database.keys();
     */
    keys(): (keyof T)[] {
        return Object.keys(this.data) as (keyof T)[];
    }
    /**
     * Get all the values in the table
     * @returns Array of values
     * @example Database.values();
     */
    values(): T[keyof T][] {
        return Object.values(this.data);
    }
    /**
     * Get all the keys and values in the table in pairs
     * @returns Array of key/value pairs
     * @example Database.entries();
     */
    entries(): [keyof T, T[keyof T]][] {
        return Object.entries(this.data) as [keyof T, T[keyof T]][];
    }
    /**
     * Check if all the keys exists in the table
     * @param keys
     * @returns Whether all keys exist
     * @example Database.hasAll('Test Key', 'Test Key 2', 'Test Key 3');
     */
    hasAll(...keys: (keyof T)[]): boolean {
        return keys.every((k) => this.has(k));
    }
    /**
     * Check if any of the keys exists in the table
     * @param keys
     * @returns Whether any key exists
     * @example Database.hasAny('Test Key', 'Test Key 2', 'Test Key 3');
     */
    hasAny(...keys: (keyof T)[]): boolean {
        return keys.some((k) => this.has(k));
    }

    private getScoreboardParticipant() {
        for (const table of objective.getParticipants()) {
            const name = table.displayName;
            if (name.startsWith(`[\\"wedit:${this.name}\\"`)) {
                return table;
            }
        }
    }
}
