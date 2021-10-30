import { BlockLocation, Location } from 'mojang-minecraft';
import { History } from './modules/history.js';
import { getPlayerDimension, printDebug, printLocation, regionMax, regionMin } from './util.js';
import { Server } from '../library/Minecraft.js';
import { Pattern } from './modules/pattern.js';
import { Regions } from './modules/regions.js';
import { Mask } from './modules/mask.js';
import { RawText } from './modules/rawtext.js';
import { TICKS_TO_DELETE_SESSION } from '../config.js';
import { Tools } from './tools/tool_manager.js';
import './tools/register_tools.js';
const playerSessions = {};
const pendingDeletion = {};
Server.on('tick', ev => {
    for (const player in pendingDeletion) {
        const session = pendingDeletion[player];
        session[0]--;
        if (session[0] < 0) {
            session[1].delete();
            delete pendingDeletion[player];
            printDebug('Deleted player session!');
        }
    }
});
export class PlayerSession {
    constructor(player) {
        this.usePickerPattern = false;
        this.globalMask = new Mask();
        this.tools = new Map();
        this._selectionMode = 'cuboid';
        this._drawSelection = true;
        this.pickerPattern = [];
        this.drawPoints = [];
        this.drawTimer = 0;
        this.player = player;
        this.history = new History(this.player);
        this.selectionPoints = [];
        this.tools.set('pattern_picker', Tools.create('pattern_picker'));
        this.tools.set('selection_wand', Tools.create('selection_wand'));
        this.tools.set('navigation_wand', Tools.create('navigation_wand'));
        this.tools.set('stacker_wand', Tools.create('stacker_wand', 5));
        this.tools.set('cut', Tools.create('cut'));
        this.tools.set('copy', Tools.create('copy'));
        this.tools.set('paste', Tools.create('paste'));
        this.tools.set('undo', Tools.create('undo'));
        this.tools.set('redo', Tools.create('redo'));
        this.tools.set('spawn_glass', Tools.create('spawn_glass'));
        this.tools.set('selection_fill', Tools.create('selection_fill'));
    }
    getPlayer() {
        return this.player;
    }
    getHistory() {
        return this.history;
    }
    reassignPlayer(player) {
        this.player = player;
        this.history.reassignPlayer(player);
    }
    setSelectionPoint(index, loc) {
        if (index > 0 && this.selectionPoints.length == 0) {
            throw RawText.translate('worldedit.selection.no-primary');
        }
        if (this.selectionPoints.length <= index) {
            this.selectionPoints.length = index + 1;
        }
        this.selectionPoints[index] = loc;
        this.updateDrawSelection();
    }
    getSelectionPoints() {
        return this.selectionPoints.slice();
    }
    clearSelectionPoints() {
        this.selectionPoints = [];
        this.updateDrawSelection();
    }
    getBlocksSelected() {
        let points = 0;
        for (const point of this.selectionPoints) {
            if (point)
                points++;
        }
        if (points == 0 || points == 1)
            return [];
        if (this._selectionMode == 'cuboid') {
            const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]);
            const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]);
            return min.blocksBetween(max);
        }
    }
    getSelectionRange() {
        if (this._selectionMode == 'cuboid') {
            const [pos1, pos2] = this.selectionPoints.slice(0, 2);
            return [regionMin(pos1, pos2), regionMax(pos1, pos2)];
        }
        return null;
    }
    updateDrawSelection() {
        this.drawPoints.length = 0;
        if (this.selectionMode == 'cuboid' && this.selectionPoints.length == 2) {
            const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);
            const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);
            const corners = [
                new Location(min.x, min.y, min.z),
                new Location(max.x + 1, min.y, min.z),
                new Location(min.x, max.y + 1, min.z),
                new Location(max.x + 1, max.y + 1, min.z),
                new Location(min.x, min.y, max.z + 1),
                new Location(max.x + 1, min.y, max.z + 1),
                new Location(min.x, max.y + 1, max.z + 1),
                new Location(max.x + 1, max.y + 1, max.z + 1)
            ];
            const edgeData = [
                [0, 1], [2, 3], [4, 5], [6, 7],
                [0, 2], [1, 3], [4, 6], [5, 7],
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];
            const edgePoints = [];
            for (const edge of edgeData) {
                const [a, b] = [corners[edge[0]], corners[edge[1]]];
                const d = [b.x - a.x + 1, b.y - a.y + 1, b.z - a.z + 1];
                const pointCount = Math.min(Math.floor(Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])), 32);
                for (let i = 1; i < pointCount; i++) {
                    let t = i / pointCount;
                    edgePoints.push(new Location((1.0 - t) * a.x + t * b.x, (1.0 - t) * a.y + t * b.y, (1.0 - t) * a.z + t * b.z));
                }
            }
            this.drawPoints = corners.concat(edgePoints);
            this.drawTimer = 0;
        }
    }
    getPickerPatternParsed() {
        if (this.pickerPattern.length) {
            return Pattern.parseBlockPermutations(this.pickerPattern);
        }
    }
    clearPickerPattern() {
        this.pickerPattern.length = 0;
    }
    addPickerPattern(blockData) {
        this.pickerPattern.push(blockData);
    }
    delete() {
        Regions.deletePlayer(this.player);
        this.history = null;
    }
    onTick(tick) {
        for (const tool of this.tools.values()) {
            tool.process(this);
        }
        if (!this.drawSelection)
            return;
        if (this.drawTimer <= 0) {
            this.drawTimer = 10;
            const dimension = getPlayerDimension(this.player)[1];
            for (const point of this.drawPoints) {
                Server.runCommand(`particle wedit:selection_draw ${printLocation(point, false)}`, dimension);
            }
        }
        this.drawTimer--;
    }
    onEntityCreate(entity, loc) {
        let processed = false;
        for (const tool of this.tools.values()) {
            processed || (processed = tool.process(this, loc));
        }
        return processed;
    }
    /**
     * Getter selectionMode
     * @return {selectMode }
     */
    get selectionMode() {
        return this._selectionMode;
    }
    /**
     * Setter selectionMode
     * @param {selectMode } value
     */
    set selectionMode(value) {
        this._selectionMode = value;
    }
    /**
     * Getter drawSelection
     * @return {boolean }
     */
    get drawSelection() {
        return this._drawSelection;
    }
    /**
     * Setter drawSelection
     * @param {boolean } value
     */
    set drawSelection(value) {
        this._drawSelection = value;
        this.drawTimer = 0;
    }
}
export function getSession(player) {
    const name = player.nameTag;
    if (!playerSessions[name]) {
        let session;
        if (pendingDeletion[name]) {
            session = pendingDeletion[name][1];
            session.reassignPlayer(player);
            delete pendingDeletion[name];
        }
        playerSessions[name] = session ?? new PlayerSession(player);
        printDebug(`new Session?: ${!session}`);
        printDebug(playerSessions[name]?.getPlayer()?.nameTag);
    }
    return playerSessions[name];
}
export function removeSession(player) {
    if (!playerSessions[player])
        return;
    playerSessions[player].clearSelectionPoints();
    playerSessions[player].clearPickerPattern();
    pendingDeletion[player] = [TICKS_TO_DELETE_SESSION, playerSessions[player]];
    delete playerSessions[player];
}
Server.on('tick', (tick) => {
    for (const player in playerSessions) {
        playerSessions[player].onTick(tick);
    }
});
Server.on('entityCreate', (entity) => {
    if (entity.id == 'wedit:block_marker') {
        const loc = new BlockLocation(Math.floor(entity.location.x), Math.floor(entity.location.y), Math.floor(entity.location.z));
        let dimension;
        for (const player in playerSessions) {
            if (playerSessions[player].onEntityCreate(entity, loc)) {
                dimension = getPlayerDimension(playerSessions[player].getPlayer())[1];
                break;
            }
        }
        entity.nameTag = 'wedit:pending_deletion_of_selector';
        if (dimension) {
            Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
            Server.runCommand(`kill @e[name=${entity.nameTag}]`, dimension);
        }
    }
});
