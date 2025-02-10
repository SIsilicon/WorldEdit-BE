/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, World, world } from "@minecraft/server";
import { Database } from "../@types/classes/databaseBuilder";
import { contentLog, Server } from "@notbeer-api";

const objective = world.scoreboard.getObjective("GAMETEST_DB") ?? world.scoreboard.addObjective("GAMETEST_DB", "");
const databases: { [k: string]: DatabaseImpl<any> } = {};
const parsers: ((key: string, value: any, databaseName: string) => any)[] = [];

function parseJSON(databaseName: string, json: string) {
    return JSON.parse(json, (key, value) => {
        for (const parser of parsers) value = parser(key, value, databaseName);
        return value;
    });
}

function getDatabaseKey(name: string, provider?: World | Entity) {
    return name + "//" + (provider instanceof Entity ? provider.id : "world");
}

class DatabaseManager {
    load<T extends object = { [key: string]: any }>(name: string, provider: World | Entity = world, legacyStorage = false) {
        const key = getDatabaseKey(name, provider);
        if (!databases[key]) {
            databases[key] = new DatabaseImpl<T>(name, provider, legacyStorage);
            databases[key].load();
        }
        return <Database<T>>databases[key];
    }

    delete(name: string, provider: World | Entity = world) {
        const key = getDatabaseKey(name, provider);
        const database = databases[key] ?? new DatabaseImpl<any>(name, provider);
        if (database.isValid()) database.delete();
        delete databases[key];
    }

    find(regexp: RegExp, provider: World | Entity = world) {
        return provider.getDynamicPropertyIds().filter((name) => name.match(regexp));
    }

    getRawData(name: string, provider: World | Entity = world) {
        const key = getDatabaseKey(name, provider);
        const database = databases[key] ?? new DatabaseImpl<any>(name, provider);
        return database.rawData;
    }

    addParser(parser: (key: string, value: any, database: string) => any) {
        parsers.push(parser);
    }
}

export const Databases = new DatabaseManager();

class DatabaseImpl<T extends object = { [key: string]: any }> implements Database<T> {
    private _data: T = <any>{};
    private loaded = false;
    private valid = true;

    constructor(
        private name: string,
        private provider: World | Entity = world,
        private legacyStorage = false
    ) {}

    get data() {
        if (!this.valid) throw new Error(`Can't get data from invalid database "${this.name}".`);
        if (!this.loaded) this.load();
        return this._data;
    }

    set data(value: T) {
        if (!this.valid) throw new Error(`Can't set data on invalid database "${this.name}".`);
        this.loaded = true;
        this._data = value;
    }

    get rawData(): string | undefined {
        const table = this.getScoreboardParticipant();
        let data: string | undefined;
        if (table) {
            data = (<string>JSON.parse(`"${table.displayName}"`)).slice(`[\\"${this.getScoreboardName()}\\"`.length - 1, -1);
        } else {
            data = <string>this.provider.getDynamicProperty(this.name);
            let page: string | undefined;
            let i = 2;
            while (data && (page = <string>this.provider.getDynamicProperty(`__page${i++}__` + this.name))) data += page;
        }
        return data;
    }

    isLoaded() {
        return this.loaded;
    }

    isValid() {
        return this.valid;
    }

    clear(): void {
        if (!this.valid) throw new Error(`Can't clear data from invalid database "${this.name}".`);
        if (!this.loaded) this.load();
        this._data = {} as T;
    }

    save(): void {
        if (!this.valid) throw new Error(`Can't save data to invalid database "${this.name}".`);

        const table = this.getScoreboardParticipant();
        if (this.legacyStorage) {
            const scoreboardName = this.getScoreboardName();
            if (table) Server.runCommand(`scoreboard players reset "${table.displayName}" GAMETEST_DB`);
            Server.runCommand(`scoreboard players add ${JSON.stringify(JSON.stringify([scoreboardName, this._data]))} GAMETEST_DB 0`);
            return;
        } else if (table && !this.legacyStorage) {
            objective.removeParticipant(table);
        }

        const data = JSON.stringify(this._data);
        // Try smaller divisions of data until the right number of pages is found.
        // 50 subdivions allow for a little more than 1.5 MB per database.
        divisions: for (let i = 1; i <= 50; i++) {
            let page: number | undefined = undefined;
            const stepSize = Math.ceil(data.length / i);
            for (let j = 0; j < data.length; j += stepSize) {
                try {
                    this.provider.setDynamicProperty((page ? `__page${page}__` : "") + this.name, data.slice(j, j + stepSize));
                    page = (page ?? 1) + 1;
                } catch {
                    continue divisions;
                }
            }
            // Remove unused pages
            while (this.provider.getDynamicProperty(`__page${page}__` + this.name)) {
                this.provider.setDynamicProperty(`__page${page!++}__` + this.name, undefined);
            }
            this.loaded = true;
            return;
        }

        contentLog.error(`Failed to save database ${this.name} to ${this.provider instanceof Entity ? this.provider.nameTag ?? this.provider.id : "the world"}`);
        contentLog.debug(contentLog.stack());
    }

    load() {
        if (!this.valid) throw new Error(`Can't load data from invalid database "${this.name}".`);
        if (this.loaded) return;
        try {
            this._data = parseJSON(this.name, this.rawData ?? "{}");
        } catch (err) {
            contentLog.error(`Failed to load database ${this.name} from ${this.provider instanceof Entity ? this.provider.nameTag ?? this.provider.id : "the world"}`);
            if (err) contentLog.debug(err, err.stack);
            return;
        }
        this.loaded = true;
    }

    delete() {
        if (!this.valid) throw new Error(`Can't delete invalid database "${this.name}".`);
        const table = this.getScoreboardParticipant();
        if (table) {
            objective.removeParticipant(table);
        } else {
            this.provider.setDynamicProperty(this.name, undefined);
            let page = 2;
            while (this.provider.getDynamicProperty(`__page${page}__` + this.name)) {
                this.provider.setDynamicProperty(`__page${page++}__` + this.name, undefined);
            }
        }
        this.valid = false;
        Databases.delete(this.name, this.provider);
    }

    toJSON() {
        const json: any = { __dbName__: this.name };
        if (this.provider instanceof Entity) json.__dbProvider__ = this.provider.id;
        if (this.legacyStorage) json.__dbLegacy__ = true;
        return json;
    }

    private getScoreboardParticipant() {
        for (const table of objective?.getParticipants() ?? []) {
            if (table.displayName.startsWith(`[\\"${this.getScoreboardName()}\\"`)) return table;
        }
    }

    private getScoreboardName() {
        let name = "wedit:" + this.name;
        if (this.provider instanceof Entity) name += this.provider.id;
        return name;
    }
}

Databases.addParser((_, value) => {
    if (!value || typeof value !== "object" || !value.__dbName__) return value;
    const provider = value.__dbProvider__ ? world.getEntity(value.__dbProvider__) : world;
    const key = getDatabaseKey(value.__dbName__, provider);
    if (!databases[key]) databases[key] = new DatabaseImpl(value.__dbName__, provider, value.__dbLegacy__);
    return databases[key];
});
