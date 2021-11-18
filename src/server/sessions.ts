import { Player, BlockLocation, TickEvent, Location, BlockPermutation, TicksPerSecond, Entity } from 'mojang-minecraft';
import { dimension } from '../library/@types/index.js';
import { History } from './modules/history.js';
import { printDebug, printLocation, regionMax, regionMin, regionSize } from './util.js';
import { Server } from '../library/Minecraft.js';
import { Pattern } from './modules/pattern.js';
import { Regions } from './modules/regions.js';
import { SettingsHotbar } from './modules/settings_hotbar.js';
import { PlayerUtil } from './modules/player_util.js';
import { Mask } from './modules/mask.js';
import { RawText } from './modules/rawtext.js';
import { TICKS_TO_DELETE_SESSION } from '../config.js';

import { Tool } from './tools/base_tool.js';
import { Tools } from './tools/tool_manager.js';
import './tools/register_tools.js';

// TODO: Add other selection modes
type selectMode = 'cuboid';

const playerSessions: {[k: string]: PlayerSession} = {};
const pendingDeletion: {[k: string]: [number, PlayerSession]} = {}

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

PlayerUtil.on('playerChangeDimension', (player, dimension) => {
    playerSessions[player.nameTag]?.clearSelectionPoints();
});

export class PlayerSession {
	public usingItem = false;
	public globalPattern = new Pattern();
	public globalMask = new Mask();
    public includeEntities = false;
    public includeAir = true;
    
    public settingsHotbar: SettingsHotbar;
    
    private currentTick = 0;
	private tools = new Map<string, Tool>();

	private player: Player;
	private history: History;
	private selectionPoints: BlockLocation[];

	private _selectionMode: selectMode = 'cuboid';
	private _drawSelection = true;
	
	private drawPoints: Location[] = [];
	private drawTimer: number = 0;
	
	constructor(player: Player) {
		this.player = player;
		this.history = new History(this.player);
		this.selectionPoints = [];
		
		this.setTool('pattern_picker');
		this.setTool('mask_picker');
		this.setTool('selection_wand');
		this.setTool('navigation_wand');
		this.setTool('config');
		this.setTool('cut');
		this.setTool('copy');
		this.setTool('paste');
		this.setTool('undo');
		this.setTool('redo');
		this.setTool('spawn_glass');
		this.setTool('selection_fill');
		Tools.unbindAll(player, this.tools);
		
        if (PlayerUtil.isHotbarStashed(player)) {
		    this.enterSettings();
        }
	}

	public getPlayer() {
		return this.player;
	}

	public getHistory() {
		return this.history;
	}

	reassignPlayer(player: Player) {
		this.player = player;
		this.history.reassignPlayer(player);
	}

	public setSelectionPoint(index: number, loc: BlockLocation): void {
		if (index > 0 && this.selectionPoints.length == 0) {
		  throw RawText.translate('worldedit.selection.no-primary');
		}
		if (this.selectionPoints.length <= index) {
			this.selectionPoints.length = index + 1;
		}
		this.selectionPoints[index] = loc;
		this.updateDrawSelection();
	}

	public getSelectionPoints() {
		return this.selectionPoints.slice();
	}

	public clearSelectionPoints() {
		this.selectionPoints = [];
		this.updateDrawSelection();
	}

	public getBlocksSelected() {
		let points = 0;
		for (const point of this.selectionPoints) {
			if (point) points++;
		}
		if (points == 0 || points == 1)
			return [];

		if (this._selectionMode == 'cuboid') {
			const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]);
			const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]);
			return min.blocksBetween(max);
		}
	}
	
	public getSelectionRange(): [BlockLocation, BlockLocation] {
		if (this._selectionMode == 'cuboid') {
			const [pos1, pos2] = this.selectionPoints.slice(0, 2);
			return [regionMin(pos1, pos2), regionMax(pos1, pos2)];
		}
		return null;
	}

	private updateDrawSelection() {
		this.drawPoints.length = 0;
		if (this.selectionMode == 'cuboid' && this.selectionPoints.length == 2) {
			const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);
			const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);

			const corners = [
				new Location(min.x  , min.y  , min.z  ),
				new Location(max.x+1, min.y  , min.z  ),
				new Location(min.x  , max.y+1, min.z  ),
				new Location(max.x+1, max.y+1, min.z  ),
				new Location(min.x  , min.y  , max.z+1),
				new Location(max.x+1, min.y  , max.z+1),
				new Location(min.x  , max.y+1, max.z+1),
				new Location(max.x+1, max.y+1, max.z+1)
			];

			const edgeData: [number, number][]= [
				[0, 1], [2, 3], [4, 5], [6, 7],
				[0, 2], [1, 3], [4, 6], [5, 7],
				[0, 4], [1, 5], [2, 6], [3, 7]
			];
			const edgePoints: Location[] = [];
			for (const edge of edgeData) {
				const [a, b] = [corners[edge[0]], corners[edge[1]]];
				const d = [b.x - a.x, b.y - a.y, b.z - a.z];
				const pointCount = Math.min(Math.floor(Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2])), 32);
				for (let i = 1; i < pointCount; i++) {
					let t = i / pointCount;
					edgePoints.push(new Location(
						(1.0 - t) * a.x + t * b.x,
						(1.0 - t) * a.y + t * b.y,
						(1.0 - t) * a.z + t * b.z
					));
				}
			}
			this.drawPoints = corners.concat(edgePoints);
		}
		
		for (const point of this.drawPoints) {
			point.x += 0.001;
			point.z += 0.001;
		}
		this.drawTimer = 0;
	}
    
	public setTool(tool: string, ...args: any[]) {
		this.tools.set(tool, Tools.create(tool, ...args));
	}
	
	public setToolProperty(tool: string, property: string, value: any) {
		(<{[k: string]: any}>this.tools.get(tool))[property] = value;
	}
	
	public hasTool(tool: string) {
		return this.tools.has(tool);
	}
	
	public unbindTool(tool: string) {
		this.tools.get(tool).unbind(this.player);
		this.tools.delete(tool);
	}
	
	public enterSettings() {
	    this.settingsHotbar = new SettingsHotbar(this);
	}
	
	delete() {
		Regions.deletePlayer(this.player);
		this.history = null;
	}

	onTick(tick: TickEvent) {
	    this.currentTick = tick.currentTick;
	    if (this.settingsHotbar) {
	        this.settingsHotbar.onTick(tick);
	    } else if (PlayerUtil.isHotbarStashed(this.player)) {
	        this.enterSettings();
	    }
	    
		for (const tool of this.tools.values()) {
			tool.process(this, this.currentTick);
		}
		
		if (!this.drawSelection) return;
		if (this.drawTimer <= 0) {
			this.drawTimer = 10;
			const dimension = PlayerUtil.getDimension(this.player)[1];
			for (const point of this.drawPoints) {
				Server.runCommand(`particle wedit:selection_draw ${printLocation(point, false)}`, dimension);
			}
		}
		this.drawTimer--;
	}
	
	onEntityCreate(entity: Entity, loc: BlockLocation): boolean {
		let processed = false;
		for (const tool of this.tools.values()) {
		    // one added to tick to compensate for late onTick call.
			processed ||= tool.process(this, this.currentTick+1, loc);
		}
		return processed;
	}
	
	/**
	 * Getter selectionMode
	 * @return {selectMode }
	 */
	public get selectionMode(): selectMode  {
		return this._selectionMode;
	}

	/**
	 * Setter selectionMode
	 * @param {selectMode } value
	 */
	public set selectionMode(value: selectMode ) {
		this._selectionMode = value;
	}
	
	/**
	 * Getter drawSelection
	 * @return {boolean }
	 */
	public get drawSelection(): boolean  {
		return this._drawSelection;
	}

	/**
	 * Setter drawSelection
	 * @param {boolean } value
	 */
	public set drawSelection(value: boolean ) {
		this._drawSelection = value;
		this.drawTimer = 0;
	}
}

export function getSession(player: Player): PlayerSession {
	const name = player.nameTag;
	if (!playerSessions[name]) {
		let session: PlayerSession
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

export function removeSession(player: string) {
	if (!playerSessions[player]) return;

	playerSessions[player].clearSelectionPoints();
	playerSessions[player].globalPattern.clear();
	pendingDeletion[player] = [TICKS_TO_DELETE_SESSION, playerSessions[player]];
	delete playerSessions[player];
}

Server.on('tick', (tick: TickEvent) => {
	for (const player in playerSessions) {
		playerSessions[player].onTick(tick);
	}
})

Server.on('entityCreate', (entity: Entity) => {
	if (entity.id == 'wedit:block_marker') {
		const loc = new BlockLocation(
			Math.floor(entity.location.x),
			Math.floor(entity.location.y),
			Math.floor(entity.location.z)
		);
		
		let dimension: dimension;
		for (const player in playerSessions) {
			if (playerSessions[player].onEntityCreate(entity, loc)) {
				dimension = PlayerUtil.getDimension(playerSessions[player].getPlayer())[1];
				break;
			}
		}
		
		entity.nameTag = 'wedit:pending_deletion_of_selector';
		if (dimension) {
			Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
			Server.runCommand(`kill @e[name=${entity.nameTag}]`, dimension);
		}
	}
})