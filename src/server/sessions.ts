import { Player, BlockLocation, TickEvent, Location, BlockPermutation, TicksPerSecond, Entity } from 'mojang-minecraft';
import { dimension } from '../library/@types/index.js';
import { History } from './modules/history.js';
import { getPlayerDimension, printDebug, printLocation, regionMax, regionMin, regionSize } from './util.js';
import { Server } from '../library/Minecraft.js';
import { Pattern } from './modules/pattern.js';
import { Regions } from './modules/regions.js';
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

export class PlayerSession {
    public usePickerPattern = false;
    public globalMask = new Mask();

    private tools = new Map<string, Tool>();

    private player: Player;
    private history: History;
    private selectionPoints: BlockLocation[];

    private _selectionMode: selectMode = 'cuboid';
    private _drawSelection = true;
    
    private pickerPattern: BlockPermutation[] = [];
    
    private drawPoints: Location[] = [];
    private drawTimer: number = 0;
    
    constructor(player: Player) {
        this.player = player;
        this.history = new History(this.player);
        this.selectionPoints = [];
        
        this.setTool('pattern_picker');
        this.setTool('pattern_air_picker');
        this.setTool('selection_wand');
        this.setTool('navigation_wand');
        this.setTool('cut');
        this.setTool('copy');
        this.setTool('paste');
        this.setTool('undo');
        this.setTool('redo');
        this.setTool('spawn_glass');
    	this.setTool('selection_fill');
	}
    
        ublic getPlayer() {
    	return this.player;
	}
    
        ublic getHistory() {
    	return this.history;
	}
    
        eassignPlayer(player: Player) {
        this.player = player;
    	this.history.reassignPlayer(player);
	}
    
        ublic setSelectionPoint(index: number, loc: BlockLocation): void {
        if (index > 0 && this.selectionPoints.length == 0) {
          throw RawText.translate('worldedit.selection.no-primary');
        }
            f (this.selectionPoints.length <= index) {
        	this.selectionPoints.length = index + 1;
        }
        this.selectionPoints[index] = loc;
    	this.updateDrawSelection();
	}
    
        ublic getSelectionPoints() {
    	return this.selectionPoints.slice();
	}
    
        ublic clearSelectionPoints() {
        this.selectionPoints = [];
    	this.updateDrawSelection();
	}
    
        ublic getBlocksSelected() {
        let points = 0;
            or (const point of this.selectionPoints) {
        	if (point) points++;
        }
            f (points == 0 || points == 1)
			return [];
        
            f (this._selectionMode == 'cuboid') {
            const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]);
            const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]);
        	return min.blocksBetween(max);
    	}
    }
    
        ublic getSelectionRange(): [BlockLocation, BlockLocation] {
            f (this._selectionMode == 'cuboid') {
            const [pos1, pos2] = this.selectionPoints.slice(0, 2);
        	return [regionMin(pos1, pos2), regionMax(pos1, pos2)];
        }
    	return null;
	}
    
        rivate updateDrawSelection() {
        this.drawPoints.length = 0;
            f (this.selectionMode == 'cuboid' && this.selectionPoints.length == 2) {
            const min = regionMin(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);
			const max = regionMax(this.selectionPoints[0], this.selectionPoints[1]).offset(-0.5, 0, -0.5);
            
                onst corners = [
                new Location(min.x  , min.y  , min.z  ),
                new Location(max.x+1, min.y  , min.z  ),
                new Location(min.x  , max.y+1, min.z  ),
                new Location(max.x+1, max.y+1, min.z  ),
                new Location(min.x  , min.y  , max.z+1),
                new Location(max.x+1, min.y  , max.z+1),
                new Location(min.x  , max.y+1, max.z+1),
            	new Location(max.x+1, max.y+1, max.z+1)
			];
            
                onst edgeData: [number, number][]= [
                [0, 1], [2, 3], [4, 5], [6, 7],
                [0, 2], [1, 3], [4, 6], [5, 7],
            	[0, 4], [1, 5], [2, 6], [3, 7]
            ];
            const edgePoints: Location[] = [];
                or (const edge of edgeData) {
                const [a, b] = [corners[edge[0]], corners[edge[1]]];
                const d = [b.x - a.x, b.y - a.y, b.z - a.z];
                const pointCount = Math.min(Math.floor(Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2])), 32);
                    or (let i = 1; i < pointCount; i++) {
                    let t = i / pointCount;
                        dgePoints.push(new Location(
                        (1.0 - t) * a.x + t * b.x,
                        (1.0 - t) * a.y + t * b.y,
                    	(1.0 - t) * a.z + t * b.z
                	));
            	}
            }
        	this.drawPoints = corners.concat(edgePoints);
        }
        
            or (const point of this.drawPoints) {
            point.x += 0.001;
        	point.z += 0.001;
        }
    	this.drawTimer = 0;
	}
    
        ublic getPickerPatternParsed() {
            f (this.pickerPattern.length) {
        	return Pattern.parseBlockPermutations(this.pickerPattern);
    	}
	}
    
        ublic clearPickerPattern() {
    	this.pickerPattern.length = 0;
	}
    
        ublic addPickerPattern(blockData: BlockPermutation) {
    	this.pickerPattern.push(blockData);
    }
    
        ublic setTool(tool: string, ...args: any[]) {
    	this.tools.set(tool, Tools.create(tool, ...args));
    }
    
        ublic setToolProperty(tool: string, property: string, value: any) {
    	(<{[k: string]: any}>this.tools.get(tool))[property] = value;
    }
    
        ublic hasTool(tool: string) {
    	return this.tools.has(tool);
    }
    
        ublic unbindTool(tool: string) {
        this.tools.get(tool).unbind(this.player);
    	this.tools.delete(tool);
    }
    
        elete() {
        Regions.deletePlayer(this.player);
    	this.history = null;
	}
    
        nTick(tick: TickEvent) {
            or (const tool of this.tools.values()) {
        	tool.process(this);
        }
        
        if (!this.drawSelection) return;
            f (this.drawTimer <= 0) {
            this.drawTimer = 10;
            const dimension = getPlayerDimension(this.player)[1];
                or (const point of this.drawPoints) {
            	Server.runCommand(`particle wedit:selection_draw ${printLocation(point, false)}`, dimension);
        	}
        }
    	this.drawTimer--;
    }
    
        nEntityCreate(entity: Entity, loc: BlockLocation): boolean {
        let processed = false;
            or (const tool of this.tools.values()) {
        	processed ||= tool.process(this, loc);
        }
    	return processed;
    }
    
    /**
     * Getter selectionMode
     * @return {selectMode }
     */
        ublic get selectionMode(): selectMode  {
    	return this._selectionMode;
	}
    
    /**
     * Setter selectionMode
     * @param {selectMode } value
     */
        ublic set selectionMode(value: selectMode ) {
    	this._selectionMode = value;
    }
    
    /**
     * Getter drawSelection
     * @return {boolean }
     */
        ublic get drawSelection(): boolean  {
    	return this._drawSelection;
	}
    
    /**
     * Setter drawSelection
     * @param {boolean } value
     */
        ublic set drawSelection(value: boolean ) {
        this._drawSelection = value;
    	this.drawTimer = 0;
	}
}

    xport function getSession(player: Player): PlayerSession {
    const name = player.nameTag;
        f (!playerSessions[name]) {
        let session: PlayerSession
            f (pendingDeletion[name]) {
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

    xport function removeSession(player: string) {
	if (!playerSessions[player]) return;
    
    playerSessions[player].clearSelectionPoints();
    playerSessions[player].clearPickerPattern();
    pendingDeletion[player] = [TICKS_TO_DELETE_SESSION, playerSessions[player]];
	delete playerSessions[player];
}

    erver.on('tick', (tick: TickEvent) => {
        or (const player in playerSessions) {
    	playerSessions[player].onTick(tick);
	}
})

    erver.on('entityCreate', (entity: Entity) => {
        f (entity.id == 'wedit:block_marker') {
            onst loc = new BlockLocation(
            Math.floor(entity.location.x),
            Math.floor(entity.location.y),
        	Math.floor(entity.location.z)
        );
        
        let dimension: dimension;
            or (const player in playerSessions) {
                f (playerSessions[player].onEntityCreate(entity, loc)) {
                dimension = getPlayerDimension(playerSessions[player].getPlayer())[1];
            	break;
        	}
        }
        
        entity.nameTag = 'wedit:pending_deletion_of_selector';
            f (dimension) {
            Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
        	Server.runCommand(`kill @e[name=${entity.nameTag}]`, dimension);
    	}
	}
})