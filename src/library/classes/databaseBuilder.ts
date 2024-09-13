/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, World, world } from "@minecraft/server";
import { Server } from "./serverBuilder.js";
import { Database } from "../@types/classes/databaseBuilder";
import { contentLog } from "@notbeer-api";

const objective = world.scoreboard.getObjective("GAMETEST_DB") ?? world.scoreboard.addObjective("GAMETEST_DB", "");
const databases: { [k: string]: DatabaseImpl<any> } = {};

export function getDatabase<T extends object = { [key: string]: any }>(name: string, provider: World | Entity = world, reviver?: (key: string, value: any) => any, legacyStorage = false) {
    const key = name + "//" + (provider instanceof Entity ? provider.id : "world");
    if (!databases[key]) databases[key] = new DatabaseImpl<T>(name, provider, reviver, legacyStorage);
    return databases[key] as DatabaseImpl<T>;
}

export function deleteDatabase(name: string, provider: World | Entity = world) {
    const key = name + "//" + (provider instanceof Entity ? provider.id : "world");
    if (databases[key]) databases[key].clear();

    const scoreboardTable = DatabaseImpl.getScoreboardParticipant(DatabaseImpl.getScoreboardName(name, provider));
    if (scoreboardTable) objective.removeParticipant(scoreboardTable);
    else provider.setDynamicProperty(name, undefined);
}

class DatabaseImpl<T extends object = { [key: string]: any }> implements Database<T> {
    private data: T;

    constructor(
        private name: string,
        private provider: World | Entity = world,
        reviver?: (key: string, value: any) => any,
        private legacyStorage = false
    ) {
        const scoreboardName = DatabaseImpl.getScoreboardName(name, provider);
        let table = DatabaseImpl.getScoreboardParticipant(scoreboardName);
        try {
            if (table) this.data = JSON.parse(JSON.parse(`"${table.displayName}"`), reviver)[1];
            else this.data = JSON.parse(<string>provider.getDynamicProperty(name) ?? "{}", reviver);

            if (table && !legacyStorage) objective.removeParticipant(table);
        } catch {
            contentLog.error(`Failed to load database ${name} from ${provider instanceof Entity ? provider.nameTag ?? provider.id : "world"}`);
            if (table) objective.removeParticipant(table), (table = undefined);
            provider.setDynamicProperty(name, undefined);
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
            const scoreboardName = DatabaseImpl.getScoreboardName(this.name, this.provider);
            const table = DatabaseImpl.getScoreboardParticipant(scoreboardName);
            if (table) Server.runCommand(`scoreboard players reset "${table.displayName}" GAMETEST_DB`);
            Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify([scoreboardName, this.data]))} GAMETEST_DB 0`);
        } else {
            this.provider.setDynamicProperty(this.name, JSON.stringify(this.data));
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

    static getScoreboardParticipant(scoreboardName: string) {
        for (const table of objective?.getParticipants() ?? []) {
            if (table.displayName.startsWith(`[\\"${scoreboardName}\\"`)) return table;
        }
    }

    static getScoreboardName(name: string, provider: World | Entity) {
        name = "wedit:" + name;
        if (provider instanceof Entity) name += provider.id;
        return name;
    }
}
