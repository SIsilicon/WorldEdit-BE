import { Player, system, Vector3 } from "@minecraft/server";
import { Server, Vector, setTickTimeout, contentLog, Databases } from "@notbeer-api";
import { Tools } from "./tools/tool_manager.js";
import { History } from "@modules/history.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { RegionBuffer, RegionSaveOptions } from "@modules/region_buffer.js";
import { Selection, selectMode } from "@modules/selection.js";
import { ConfigContext } from "./ui/types.js";
import config from "config.js";
import { Database } from "library/@types/classes/databaseBuilder.js";

const playerSessions: Map<string, PlayerSession> = new Map();
const pendingDeletion: Map<string, [number, PlayerSession]> = new Map();

Server.on("playerChangeDimension", (ev) => {
    playerSessions.get(ev.player.id)?.selection.clear();
});

interface regionTransform {
    originalLoc?: Vector;
    originalDim?: string;
    offset: Vector;
    rotation: Vector;
    flip: Vector;
}

interface superPickaxe {
    enabled: boolean;
    mode: "single" | "area" | "recursive";
    range: number;
}

interface gradients {
    [id: string]: { dither: number; patterns: Pattern[] };
}

Databases.addParser((key, value, databaseName) => {
    if (databaseName === "gradients" && value && typeof value === "object" && value.patterns) {
        try {
            value.patterns = (<string[]>value.patterns).map((v) => new Pattern(v));
            return value;
        } catch {
            contentLog.error(`Failed to load gradient ${key}`);
        }
    } else {
        return value;
    }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id !== "wedit:reset_gradients_database" || !sourceEntity) return;
    Databases.delete("gradients", sourceEntity);
});

/**
 * Represents a WorldEdit user's current session with the addon.
 * It manages their selections, operation history, and other things related to WorldEdit per player.
 */
export class PlayerSession {
    /**
     * Is true while a WorldEdit command is being called from an item; false otherwise.
     * @readonly
     */
    public usingItem = false;

    /**
     * A pattern created by the pattern picker
     * It's used by custom commands that are called from items.
     */
    public globalPattern = new Pattern();

    /**
     * A global mask created by the mask picker and ;gmask.
     * It's used by various commands and operation that are affected by masks such as the ;cyl command and brushes in combination of their own masks.
     */
    public globalMask = new Mask();

    /**
     * Whether the copy and cut items should include entities in the clipboard.
     */
    public includeEntities = false;

    /**
     * Whether the copy and cut items should include air in the clipboard.
     */
    public includeAir = false;

    /**
     * Whether the session should run in performance mode.
     */
    public performanceMode = false;

    /**
     * The amount of blocks that can be changed in one operation.
     */
    public changeLimit = config.defaultChangeLimit == -1 ? Infinity : config.defaultChangeLimit;

    /**
     * The clipboard region created by the player.
     */
    public clipboard: RegionBuffer;

    /**
     * The transformation properties currently on the clipboard
     */
    public clipboardTransform: regionTransform = {
        offset: Vector.ZERO,
        rotation: Vector.ZERO,
        flip: Vector.ONE,
    };

    public superPickaxe: superPickaxe = {
        enabled: false,
        mode: "single",
        range: 0,
    };

    public selection: Selection;

    private player: Player;
    private playerId: string;
    private history: History;
    private regions = new Map<string, RegionBuffer>();
    private gradients: Database<gradients>;
    private placementMode: "player" | "selection" = "player";

    private _drawOutlines: boolean | "local";

    constructor(player: Player) {
        this.player = player;
        this.playerId = player.id;
        this.history = new History(this);
        this.selection = new Selection(player);
        this.drawOutlines = config.drawOutlines;
        this.gradients = Databases.load<gradients>("gradients", player);

        if (!this.getTools().length) {
            this.bindTool("selection_wand", config.wandItem);
            this.bindTool("navigation_wand", config.navWandItem);
        }
        if (PlayerUtil.isHotbarStashed(player)) {
            PlayerUtil.restoreHotbar(player);
        }

        for (const tag of player.getTags()) {
            if (tag.startsWith("wedit:defaultTag_")) {
                this.selection.mode = tag.split("_", 2)[1] as selectMode;
            }
        }
    }

    public set drawOutlines(val: boolean | "local") {
        this._drawOutlines = val;
        this.selection.visible = val;
    }

    public get drawOutlines() {
        return this._drawOutlines;
    }

    /**
     * @return The player that this session handles
     */
    public getPlayer() {
        return this.player;
    }

    /**
     * @return The history handler that this session uses
     */
    public getHistory() {
        return this.history;
    }

    /**
     * @internal
     */
    reassignPlayer(player: Player) {
        this.player = player;
        this.playerId = player.id;
        this.selection = new Selection(player);
    }

    /**
     * Toggles the placement position between the player and first selection position
     */
    togglePlacementPosition() {
        this.placementMode = this.placementMode == "player" ? "selection" : "player";
    }

    /**
     * Get the position the player may use while executing a command, such as ;fill and ;sphere
     * @returns placement position
     */
    getPlacementPosition() {
        if (this.placementMode == "player") {
            return Vector.from(this.player.location).floor();
        } else {
            const point = this.selection.points[0];
            if (!point) throw "";
            return point.clone();
        }
    }

    /**
     * Binds a new tool to this session.
     * @param tool The id of the tool being made
     * @param item The id of the item to bind to (null defaults to held item)
     * @param args Optional parameters the tool uses during its construction.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public bindTool(tool: string, item: string | null, ...args: any[]) {
        if (!item) {
            item = Server.player.getHeldItem(this.player)?.typeId;
        }
        return Tools.bind(tool, item, this.playerId, ...args);
    }

    /**
     * Tests for a property of a tool in the session's player's main hand.
     * @param item The id of the item with the tool to test (null defaults to held item)
     * @param property The name of the tool's property
     */
    public hasToolProperty(item: string | null, property: string) {
        if (!item) {
            item = Server.player.getHeldItem(this.player)?.typeId;
        }
        return Tools.hasProperty(item, this.playerId, property);
    }

    /**
     * Sets a property of a tool in the session's player's main hand.
     * @param item The id of the item with the tool to set the property of (null defaults to held item)
     * @param property The name of the tool's property
     * @param value The new value of the tool's property
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public setToolProperty(item: string | null, property: string, value: any) {
        if (!item) {
            item = Server.player.getHeldItem(this.player)?.typeId;
        }
        return Tools.setProperty(item, this.playerId, property, value);
    }

    /**
     * @param item The id of the item to test (null defaults to held item)
     * @returns Whether the session has a tool binded to the player's hand.
     */
    public hasTool(item: string | null) {
        if (!item) {
            item = Server.player.getHeldItem(this.player)?.typeId;
        }
        return Tools.hasBinding(item, this.playerId);
    }

    /**
     * @param item The id of the item to unbind from (null defaults to held item)
     * Unbinds a tool from this session's player's hand.
     */
    public unbindTool(item: string | null) {
        if (!item) {
            item = Server.player.getHeldItem(this.player)?.typeId;
        }
        return Tools.unbind(item, this.playerId);
    }

    /**
     * @param type The name of the tool to filter by
     * @returns The ids of the items that are bound to a tool
     */
    public getTools(type?: RegExp | string) {
        return Tools.getBoundItems(this.playerId, type);
    }

    /**
     * Triggers the hotbar setting menu to appear.
     */
    public enterSettings() {
        Server.uiForms.show<ConfigContext>("$configMenu", this.player, {
            session: this,
        });
        // this.settingsHotbar = new SettingsHotbar(this);
    }

    public *createRegion(start: Vector3, end: Vector3, options: RegionSaveOptions = {}) {
        const buffer = yield* RegionBuffer.createFromWorld(start, end, this.player.dimension, {
            ...options,
            recordBlocksWithData: (options.recordBlocksWithData ?? true) && !config.performanceMode && !this.performanceMode,
        });
        if (buffer) {
            this.regions.set(buffer.id, buffer);
            return buffer;
        }
    }

    public deleteRegion(buffer: RegionBuffer) {
        buffer?.deref();
        this.regions.delete(buffer?.id);
    }

    public createGradient(id: string, dither: number, patterns: Pattern[]) {
        this.gradients.data[id] = { dither, patterns };
        this.gradients.save();
    }

    public getGradient(id: string) {
        return this.gradients.data[id];
    }

    public getGradientNames() {
        return Object.keys(this.gradients.data);
    }

    public deleteGradient(id: string) {
        delete this.gradients.data[id];
        this.gradients.save();
    }

    delete() {
        for (const region of this.regions.values()) region.deref();
        this.regions.clear();
        this.history.delete();
        this.history = null;
    }

    onTick() {
        // Draw Selection
        this.selection?.draw();
    }
}

export function getSession(player: Player): PlayerSession {
    const id = player.id;
    if (!playerSessions.has(id)) {
        let session: PlayerSession;
        if (pendingDeletion.has(id)) {
            session = pendingDeletion.get(id)[1];
            session.reassignPlayer(player);
            pendingDeletion.delete(id);
        }
        playerSessions.set(id, session ?? new PlayerSession(player));
        contentLog.debug(playerSessions.get(id)?.getPlayer()?.name + ` (${id})`);
        contentLog.debug(`new Session?: ${!session}`);
    }
    return playerSessions.get(id);
}

export function removeSession(playerId: string) {
    if (!playerSessions.has(playerId)) return;

    playerSessions.get(playerId).selection.clear();
    playerSessions.get(playerId).globalPattern.clear();
    pendingDeletion.set(playerId, [config.ticksToDeleteSession, playerSessions.get(playerId)]);
    playerSessions.delete(playerId);
}

export function hasSession(playerId: string) {
    return playerSessions.has(playerId);
}

// Delayed a tick so that it's processed before other listeners
setTickTimeout(() => {
    Server.prependListener("tick", () => {
        for (const player of pendingDeletion.keys()) {
            const session = pendingDeletion.get(player);
            session[0]--;
            if (session[0] < 0) {
                session[1].delete();
                pendingDeletion.delete(player);
                contentLog.log(`session for player ${player} has been deleted.`);
            }
        }

        for (const session of playerSessions.values()) {
            session.onTick();
        }
    });
}, 1);
