/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, World, world } from "@minecraft/server";
import { Server } from "./serverBuilder.js";
import { Database } from "../@types/classes/databaseBuilder.js";
import { contentLog } from "@notbeer-api";

const objective = world.scoreboard.getObjective("GAMETEST_DB") ?? world.scoreboard.addObjective("GAMETEST_DB", "");
const databases: { [k: string]: _Database<any> } = {};

export function getDatabase<T extends object = { [key: string]: any }>(name: string, provider: World | Entity = world, reviver?: (key: string, value: any) => any, legacyStorage = false) {
    const key = name + "//" + (provider instanceof Entity ? provider.id : "world");
    if (!databases[key]) databases[key] = new _Database<T>(name, provider, reviver, legacyStorage);
    return databases[key] as _Database<T>;
}

class _Database<T extends object = { [key: string]: any }> implements Database<T> {
    private data: T;

    constructor(
        private name: string,
        private provider: World | Entity = world,
        reviver?: (key: string, value: any) => any,
        private legacyStorage = false
    ) {
        let table = this.getScoreboardParticipant();
        try {
            if (table) this.data = JSON.parse(JSON.parse(`"${table.displayName}"`), reviver)[1];
            else this.data = JSON.parse(<string>provider.getDynamicProperty("__database__" + name) ?? "{}", reviver);

            if (table && !legacyStorage) objective.removeParticipant(table);
        } catch {
            contentLog.error(`Failed to load database ${name} from ${provider instanceof Entity ? provider.nameTag ?? provider.id : "world"}`);
            if (table) objective.removeParticipant(table), (table = undefined);
            provider.setDynamicProperty("__database__" + name, undefined);
            this.data = <any>{};
        }
    }

    set<S extends keyof T>(key: S, value: T[S]): void {
        this.data[key] = value;
    }
    get<S extends keyof T>(key: S): T[S] {
        return this.data[key];
    }
    has(key: keyof T): boolean {
        return key in this.data;
    }
    delete(key: keyof T): void {
        delete this.data[key];
    }
    clear(): void {
        this.data = {} as T;
    }
    save(): void {
        if (this.legacyStorage) {
            const table = this.getScoreboardParticipant();
            if (table) Server.runCommand(`scoreboard players reset "${table.displayName}" GAMETEST_DB`);
            Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify([this.getScoreboardName(), this.data]))} GAMETEST_DB 0`);
        } else {
            this.provider.setDynamicProperty("__database__" + this.name, JSON.stringify(this.data));
        }
    }
    keys() {
        return <(keyof T)[]>Object.keys(this.data);
    }
    values() {
        return <T[keyof T][]>Object.values(this.data);
    }
    entries<S extends keyof T>() {
        return <[S, T[S]][]>Object.entries(this.data);
    }

    private getScoreboardParticipant() {
        const test = this.getScoreboardName();
        for (const table of objective.getParticipants()) {
            if (table.displayName.startsWith(`[\\"${test}\\"`)) return table;
        }
    }

    private getScoreboardName() {
        let name = "wedit:" + this.name;
        if (this.provider instanceof Entity) name += this.provider.id;
        return name;
    }
}
