import { Player, BlockLocation, Dimension, TickEvent, BeforeItemUseEvent, Location, BlockPermutation, TicksPerSecond, Entity } from 'mojang-minecraft';
import { History } from '@modules/history.js';
import { printDebug, printLocation, regionSize, regionVolume } from './util.js';
import { Server, setTickTimeout } from '@library/Minecraft.js';
import { Pattern } from '@modules/pattern.js';
import { Regions } from '@modules/regions.js';
import { Vector } from '@modules/vector.js';
import { SettingsHotbar } from '@modules/settings_hotbar.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Mask } from '@modules/mask.js';
import { RawText } from '@modules/rawtext.js';
import { TICKS_TO_DELETE_SESSION, DRAW_SELECTION } from '../config.js';

import { Tool } from './tools/base_tool.js';
import { Tools } from './tools/tool_manager.js';
import './tools/register_tools.js';

// TODO: Add other selection modes
export type selectMode = 'cuboid';

const playerSessions: Map<string, PlayerSession> = new Map();
const pendingDeletion: Map<string, [number, PlayerSession]> = new Map();

PlayerUtil.on('playerChangeDimension', (player, dimension) => {
    playerSessions.get(player.name)?.clearSelectionPoints();
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
    public includeAir = true;
    
    /**
    * Handles the settings UI created from the config item.
    * Is null when the UI isn't active.
    */
    public settingsHotbar: SettingsHotbar;
    
    private currentTick = 0;

    private player: Player;
    private history: History;
    private selectionPoints: BlockLocation[];

    private _selectionMode: selectMode = 'cuboid';
    private _drawSelection = DRAW_SELECTION;
    
    private drawPoints: Vector[] = [];
    private drawTimer: number = 0;
    
    constructor(player: Player) {
        this.player = player;
        this.history = new History(this.player);
        this.selectionPoints = [];
        
        if (PlayerUtil.isHotbarStashed(player)) {
            this.enterSettings();
        }
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
        this.history.reassignPlayer(player);
    }
    
    /**
    * Sets either the first or second selection point of a selection.
    * @remarks This will eventially be revamped once multiple selection modes are implemented.
    * @param index The first or second selection point
    * @param loc The location the selection point is being made
    */
    public setSelectionPoint(index: 0|1, loc: BlockLocation): void {
        if (index > 0 && this.selectionPoints.length == 0) {
        throw RawText.translate('worldedit.selection.noPrimary');
        }
        if (this.selectionPoints.length <= index) {
            this.selectionPoints.length = index + 1;
        }
        this.selectionPoints[index] = loc;
        this.updateDrawSelection();
    }
    
    /**
    * @return An array of selection points
    */
    public getSelectionPoints() {
        return this.selectionPoints.slice();
    }
    
    /**
    * Clears the selection points that have been made.
    */
    public clearSelectionPoints() {
        this.selectionPoints = [];
        this.updateDrawSelection();
    }
    
    /**
    * @return The blocks within the current selection
    */
    public getBlocksSelected() {
        let points = 0;
        for (const point of this.selectionPoints) {
            if (point) points++;
        }
        if (points == 0 || points == 1)
            return [];

        if (this._selectionMode == 'cuboid') {
            const min = Vector.min(this.selectionPoints[0], this.selectionPoints[1]);
            const max = Vector.max(this.selectionPoints[0], this.selectionPoints[1]);
            return min.toBlock().blocksBetween(max.toBlock());
        }
    }
    
    public getSelectedBlockCount() {
        let points = 0;
        for (const point of this.selectionPoints) {
            if (point) points++;
        }
        if (points == 0 || points == 1)
            return 0;

        if (this._selectionMode == 'cuboid') {
            return regionVolume(this.selectionPoints[0], this.selectionPoints[1]);
        }
    }
    
    /**
    * @return The minimum and maximum points of the selection
    */
    public getSelectionRange(): [BlockLocation, BlockLocation] {
        if (this._selectionMode == 'cuboid') {
            const [pos1, pos2] = this.selectionPoints.slice(0, 2);
            return [Vector.min(pos1, pos2).toBlock(), Vector.max(pos1, pos2).toBlock()];
        }
        return null;
    }
    
    /**
    * Binds a new tool to this session.
    * @param tool The id of the tool being made
    * @param args Optional parameters the tool uses during its construction.
    */
    public bindTool(tool: string, ...args: any[]) {
        Tools.bind(tool, this.player, ...args);
    }
    
    /**
    * Tests for a property of a tool in the session's player's main hand.
    * @param property The name of the tool's property
    */
    public hasToolProperty(property: string) {
        return Tools.hasProperty(this.player, property);
    }
    
    /**
    * Sets a property of a tool in the session's player's main hand.
    * @param property The name of the tool's property
    * @paran value The new value of the tool's property
    */
    public setToolProperty(property: string, value: any) {
        return Tools.setProperty(this.player, property, value);
    }
    
    /**
    * @return Whether the session has a tool binded to the player's hand.
    */
    public hasTool() {
        return Tools.hasBinding(this.player);
    }
    
    /**
    * Unbinds a tool from this session's player's hand.
    */
    public unbindTool() {
        Tools.unbind(this.player);
    }
    
    /**
    * Triggers the hotbar setting menu to appear.
    */
    public enterSettings() {
        this.settingsHotbar = new SettingsHotbar(this);
    }
    
    /**
    * Triggers the hotbar settings menu to disappear.
    */
    public exitSettings() {
        this.settingsHotbar.exit();
        this.settingsHotbar = null;
    }
    
    delete() {
        Regions.deletePlayer(this.player);
        Tools.deleteBindings(this.player);
        this.history = null;
    }
    
    private updateDrawSelection() {
        this.drawPoints.length = 0;
        
        if (this.selectionMode == 'cuboid' && this.selectionPoints.length == 2) {
            const min = Vector.min(this.selectionPoints[0], this.selectionPoints[1]).add(Vector.ZERO);
            const max = Vector.max(this.selectionPoints[0], this.selectionPoints[1]).add(Vector.ONE);

            const corners = [
                new Vector(min.x, min.y, min.z),
                new Vector(max.x, min.y, min.z),
                new Vector(min.x, max.y, min.z),
                new Vector(max.x, max.y, min.z),
                new Vector(min.x, min.y, max.z),
                new Vector(max.x, min.y, max.z),
                new Vector(min.x, max.y, max.z),
                new Vector(max.x, max.y, max.z)
            ];

            const edgeData: [number, number][]= [
                [0, 1], [2, 3], [4, 5], [6, 7],
                [0, 2], [1, 3], [4, 6], [5, 7],
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];
            const edgePoints: Vector[] = [];
            for (const edge of edgeData) {
                const [a, b] = [corners[edge[0]], corners[edge[1]]];
                const pointCount = Math.min(Math.floor(b.sub(a).length), 16);
                for (let i = 1; i < pointCount; i++) {
                    let t = i / pointCount;
                    edgePoints.push(a.lerp(b, t));
                }
            }
            this.drawPoints = corners.concat(edgePoints);
        }
        
        // A slight offset is made since exact integers snap the particles to the center of blocks.
        for (const point of this.drawPoints) {
            point.x += 0.001;
            point.z += 0.001;
        }
        this.drawTimer = 0;
    }
    
    onTick(tick: TickEvent) {
        this.currentTick = tick.currentTick;
        
        // Process settingsHotbar
        if (this.settingsHotbar) {
            this.settingsHotbar.onTick(tick);
        } else if (PlayerUtil.isHotbarStashed(this.player)) {
            this.enterSettings();
        }
        
        // Draw Selection
        if (!this.drawSelection) return;
        if (this.drawTimer <= 0) {
            this.drawTimer = 10;
            const dimension = this.player.dimension;
            for (const point of this.drawPoints) {
                Server.runCommand(`particle wedit:selection_draw ${point.print()}`, dimension);
            }
        }
        this.drawTimer--;
    }
    
    onItemUse(ev: BeforeItemUseEvent) {
        if (this.settingsHotbar) {
            this.settingsHotbar.onItemUse(ev);
        }
    }
    
    /**
    * Getter selectionMode
    * @return {selectMode}
    */
    public get selectionMode(): selectMode  {
        return this._selectionMode;
    }

    /**
    * Setter selectionMode
    * @param {selectMode} value
    */
    public set selectionMode(value: selectMode) {
        this._selectionMode = value;
        this.clearSelectionPoints();
    }
    
    /**
    * Getter drawSelection
    * @return {boolean}
    */
    public get drawSelection(): boolean  {
        return this._drawSelection;
    }

    /**
    * Setter drawSelection
    * @param {boolean} value
    */
    public set drawSelection(value: boolean) {
        this._drawSelection = value;
        this.drawTimer = 0;
    }
}

export function getSession(player: Player): PlayerSession {
    const name = player.name;
    if (!playerSessions.has(name)) {
        let session: PlayerSession
        if (pendingDeletion.has(name)) {
            session = pendingDeletion.get(name)[1];
            session.reassignPlayer(player);
            pendingDeletion.get(name);
        }
        playerSessions.set(name, session ?? new PlayerSession(player));
        printDebug(playerSessions.get(name)?.getPlayer()?.name);
        printDebug(`new Session?: ${!session}`);
    }
    return playerSessions.get(name);
}

export function removeSession(player: string) {
    if (!playerSessions.has(player)) return;

    playerSessions.get(player).clearSelectionPoints();
    playerSessions.get(player).globalPattern.clear();
    pendingDeletion.set(player, [TICKS_TO_DELETE_SESSION, playerSessions.get(player)]);
    playerSessions.delete(player);
}

export function hasSession(player: string) {
    return playerSessions.has(player);
}

// Delayed a tick so that it's processed before other listeners
setTickTimeout(() => {
    Server.prependListener('tick', ev => {
        for (const player of pendingDeletion.keys()) {
            const session = pendingDeletion.get(player);
            session[0]--;
            if (session[0] < 0) {
                session[1].delete();
                pendingDeletion.delete(player);
                printDebug('Deleted player session!');
            }
        }
        
        for (const session of playerSessions.values()) {
            session.onTick(ev);
        }
    });
    
    Server.prependListener('beforeItemUse', ev => {
        if (ev.source.id == 'minecraft:player') {
            const name = (ev.source as Player).name;
            playerSessions.get(name)?.onItemUse(ev);
        }
    });
}, 1);
