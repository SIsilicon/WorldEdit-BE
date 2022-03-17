import { BlockLocation } from 'mojang-minecraft';
import { PlayerSession } from '../../sessions.js';
import { printDebug } from '../../util.js';
import { assertSelection, assertCanBuildWithin } from '@modules/assert.js';
import { Vector } from '@modules/vector.js';
import { PlayerUtil } from '@modules/player_util.js';
import { Mask } from '@modules/mask.js';
import { Regions } from '@modules/regions.js';
import { Shape } from '../../shapes/base_shape.js';
import { CuboidShape } from '../../shapes/cuboid.js';
import { getWorldMinY, getWorldMaxY } from '../../util.js';
import { commandList } from '../command_list.js';
import { RawText } from '@modules/rawtext.js';

const registerInformation = {
    name: 'smooth',
    permission: 'worldedit.region.smooth',
    description: 'commands.wedit:smooth.description',
    usage: [
        {
            name: 'iterations',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        },
        {
            name: 'mask',
            type: 'Mask',
            default: new Mask()
        }
    ]
};

export function smooth(session: PlayerSession, iter: number, shape: Shape, loc: BlockLocation, heightMask: Mask, mask: Mask) {
    const range = shape.getRegion(loc);
    range[0].y = Math.max(getWorldMinY(session.getPlayer()), range[0].y);
    range[1].y = Math.min(getWorldMaxY(session.getPlayer()), range[1].y);
    mask = mask ? mask.intersect(session.globalMask) : session.globalMask;
    
    type map = (number | null)[][];
    
    function getMap(arr: map, x: number, z: number) {
        return arr[x]?.[z] ?? null;
    }
    
    function createMap(sizeX: number, sizeZ: number): map {
        const arr = [];
        for (let x = 0; x < sizeX; x++) {
            const arrX = [];
            for (let z = 0; z < sizeZ; z++) {
                arrX.push(null);
            }
            arr.push(arrX);
        }
        return arr;
    }
    
    function modifyMap(arr: map, func: (x: number, z: number) => (number | null)) {
        for (let x = 0; x < arr.length; x++) {
            for (let z = 0; z < arr[x].length; z++) {
                arr[x][z] = func(x, z);
            }
        }
    }
    
    const [sizeX, sizeZ] = [range[1].x-range[0].x+1, range[1].z-range[0].z+1];
    let map = createMap(sizeX, sizeZ);
    let bottom = createMap(sizeX, sizeZ);
    let top = createMap(sizeX, sizeZ);
    let base = createMap(sizeX, sizeZ);
    
    const player = session.getPlayer()
    const dim = player.dimension;
    const minY = getWorldMinY(player);
    const maxY = getWorldMaxY(player);
    modifyMap(map, (x, z) => {
        let yRange = shape.getYRange(x, z);
        if (yRange == null) return;
        
        yRange[0] = Math.max(yRange[0] + loc.y, minY);
        yRange[1] = Math.min(yRange[1] + loc.y, maxY);
        
        for (var h = new BlockLocation(x+range[0].x, yRange[1], z+range[0].z); h.y >= yRange[0]; h.y--) {
            if (!dim.getBlock(h).isEmpty && heightMask.matchesBlock(h, dim)) {
                break;
            }
        }
        if (h.y != yRange[0] - 1) {
            base[x][z] = h.y;
            bottom[x][z] = yRange[0];
            top[x][z] = yRange[1];
            return h.y;
        }
    });
    
    let back = createMap(sizeX, sizeZ);
    for (let i = 0; i < iter; i++) {
        modifyMap(back, (x, z) => {
            let c = getMap(map, x, z);
            if (c == null) return null;
            
            let height = c * 0.6;
            height += (getMap(map, x, z-1) ?? c) * 0.2;
            height += (getMap(map, x, z+1) ?? c) * 0.2;
            return height;
        });
        modifyMap(map, (x, z) => {
            let c = getMap(back, x, z);
            if (c == null) return null;
            
            let height = c * 0.6;
            height += (getMap(back, x-1, z) ?? c) * 0.2;
            height += (getMap(back, x+1, z) ?? c) * 0.2;
            return height;
        });
    }
    
    const history = session.getHistory();
    
    history.record();
    history.addUndoStructure(range[0], range[1], 'any');
    modifyMap(back, (x, z) => {
        if (getMap(map, x, z) == null) return;
        
        const worldPos = new Vector(x, 0, z).add(range[0]);
        const oldHeight = getMap(base, x, z);
        const minY = getMap(bottom, x, z);
        const maxY = getMap(top, x, z);
        const heightDiff = getMap(map, x, z) - oldHeight;
        
        if (heightDiff >= 0.5) {
            for (let h = new BlockLocation(x+range[0].x, maxY, z+range[0].z); h.y >= minY; h.y--) {
                const newH = new BlockLocation(h.x, Math.max(h.y - heightDiff, minY-1), h.z);
                if (dim.isEmpty(newH) || mask.matchesBlock(newH, dim)) {
                    Regions.save('temp', newH, newH, player);
                }
                if (dim.isEmpty(h) || mask.matchesBlock(h, dim)) {
                    Regions.load('temp', h, player);
                }
            }
        } else if (heightDiff <= -0.5) {
            for (let h = new BlockLocation(x+range[0].x, minY, z+range[0].z); h.y <= maxY; h.y++) {
                const newH = new BlockLocation(h.x, Math.min(h.y - heightDiff, maxY+1), h.z);
                if (dim.isEmpty(newH) || mask.matchesBlock(newH, dim)) {
                    Regions.save('temp', newH, newH, player);
                }
                if (dim.isEmpty(h) || mask.matchesBlock(h, dim)) {
                    Regions.load('temp', h, player);
                }
            }
        }
        return 0;
    });
    Regions.delete('temp', player);
    history.addRedoStructure(range[0], range[1], 'any');
    history.commit();
}

commandList['smooth'] = [registerInformation, (session, builder, args) => {
    assertSelection(session);
    assertCanBuildWithin(builder.dimension, ...session.getSelectionRange());
    
    let count = 0;
    let [start, end] = session.getSelectionRange();
    if (session.selectionMode == 'cuboid' || session.selectionMode == 'extend') {
        const size = Vector.sub(end, start).add(Vector.ONE);
        const shape = new CuboidShape(size.x, size.y, size.z);
        smooth(session, args.get('iterations'), shape, start, args.get('mask'), null);
    }
    
    return RawText.translate('commands.blocks.wedit:changed').with(`${count}`);
}];
