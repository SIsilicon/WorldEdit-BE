import { Player, BlockType, BlockTypes } from "@minecraft/server";
import { Databases } from "@notbeer-api";
import { Database } from "library/@types/classes/databaseBuilder";

class PersistenceGroupItem<T> {
    private database: Database;
    public readonly key: string;

    constructor(database: Database, key: string) {
        this.database = database;
        this.key = key;
    }

    get value(): T {
        return this.database.data[this.key];
    }

    set value(itemValue: T) {
        this.database.data[this.key] = itemValue;
    }

    commit() {
        this.database.save();
    }
}

class PersistenceGroup {
    private database: Database;

    constructor(database: Database) {
        this.database = database;
    }

    deleteItem(key: string) {
        delete this.database.data[key];
        this.database.save();
    }

    getOrCreateItem<T>(key: string, item: T) {
        if (!(key in this.database.data)) this.database.data[key] = item;
        const itemImpl = new PersistenceGroupItem<T>(this.database, key);
        itemImpl.value = item;
        return itemImpl;
    }

    fetchItem<T>(key: string) {
        if (!(key in this.database.data)) return undefined;
        return new PersistenceGroupItem<T>(this.database, key);
    }

    listItemNames() {
        return Object.keys(this.database.data);
    }

    dispose() {
        return this.database.unload();
    }
}

export class PersistenceManager {
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    getOrCreateGroup(namespaceName: string) {
        return new PersistenceGroup(Databases.load("editor_persistence__" + namespaceName, this.player));
    }

    deleteGroup(namespaceName: string) {
        return Databases.delete("editor_persistence__" + namespaceName, this.player);
    }

    getGroup(namespaceName: string) {
        if (Databases.find(new RegExp(`^editor_persistence__${namespaceName}$`), this.player).length === 0) {
            return undefined;
        }
        return this.getOrCreateGroup(namespaceName);
    }

    getGroups() {
        const groups = Databases.find(new RegExp(`^editor_persistence__`), this.player);
        const persistenceGroupList = [];
        for (const group of groups) {
            persistenceGroupList.push(new PersistenceGroup(Databases.load(group, this.player)));
        }
        return persistenceGroupList;
    }

    disposeAllGroups() {
        const groups = Databases.find(new RegExp(`^editor_persistence__`), this.player);
        for (const group of groups) Databases.delete(group, this.player);
    }
}

export function convertBlockStringsToBlockType(blockString: Readonly<string[]>) {
    const blockTypes: BlockType[] = [];
    for (let blockStringElement of blockString) {
        if (!blockStringElement.includes(":")) {
            blockStringElement = "minecraft:" + blockStringElement;
        }
        const blockType = BlockTypes.get(blockStringElement);
        if (blockType) {
            blockTypes.push(blockType);
        }
    }
    return blockTypes;
}

export function convertBlockTypesToBlockStrings(blockTypes: Readonly<BlockType[]>) {
    const blockStrings: string[] = [];
    for (const blockType of blockTypes) {
        let blockName = blockType.id;
        if (blockName.startsWith("minecraft:")) {
            blockName = blockName.substring(10);
        }
        blockStrings.push(blockName);
    }
    return blockStrings;
}

interface InputMarkupProperties {
    showUnset?: boolean;
    ignoreFormat?: boolean;
    prefix?: string;
    contextId?: string;
}

export function getInputMarkup(id: string, props?: InputMarkupProperties) {
    let markupStart = "[~*input|$id=" + id;
    if (props?.showUnset) {
        markupStart = markupStart.concat("|showUnset");
    }
    if (!props || !props.ignoreFormat) {
        markupStart = markupStart.concat("|$format=", props?.prefix ?? "[", "*input");
        markupStart = markupStart.concat(props?.prefix ?? "]");
    }
    if (props?.contextId) {
        markupStart = markupStart.concat("|$contextId=", props.contextId);
    }
    return markupStart.concat("~]");
}

export enum RelativeDirection {
    Forward,
    Right,
    Back,
    Left,
    Up,
    Down,
}

const directionLookup = {
    [RelativeDirection.Forward]: { x: 0, y: 0, z: 1 },
    [RelativeDirection.Right]: { x: -1, y: 0, z: 0 },
    [RelativeDirection.Back]: { x: 0, y: 0, z: -1 },
    [RelativeDirection.Left]: { x: 1, y: 0, z: 0 },
    [RelativeDirection.Up]: { x: 0, y: 1, z: 0 },
    [RelativeDirection.Down]: { x: 0, y: -1, z: 0 },
};

export function getRotationCorrectedDirection(rotationY: number, realDirection: RelativeDirection) {
    if (realDirection === RelativeDirection.Up || realDirection === RelativeDirection.Down) {
        return realDirection;
    }
    const directionQuadrant = Math.floor(((rotationY + 405 + realDirection * 90) % 360) / 90);
    return directionQuadrant;
}

export function getRotationCorrectedDirectionVector(rotationY: number, realDirection: RelativeDirection) {
    const relativeDirection = getRotationCorrectedDirection(rotationY, realDirection);
    return directionLookup[relativeDirection];
}
