import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { getPlayerBlockLocation, getPlayerDimension, printDebug, printLocation, regionMin, regionSize, regionVolume, subtractLocations } from '../util.js';
import { RawText } from './rawtext.js';

interface StructureMeta {
    position: BlockLocation;
    size: BlockLocation;
    origin: BlockLocation;
    blockCount: number;
}

class RegionsManager {
    private structures: {[k: string]: StructureMeta} = {}

    private static genName(name: string, player: Player) {
        return `wedit:${name}_${player.nameTag.replace(' ', '_')}`
    }
    
    save(name: string, start: BlockLocation, end: BlockLocation, player: Player) {
        const size = regionSize(start, end);
        if (size.x > 64 || size.y > 256 || size.z > 64) {
            throw RawText.translate('worldedit.error.max-region-size');
        }        
        
        const structName = RegionsManager.genName(name, player);
        if (!Server.runCommand(`structure save ${structName} ${printLocation(start, false)} ${printLocation(end, false)} false memory`, getPlayerDimension(player)[1]).error) {
            const position = regionMin(start, end);
            this.structures[structName] = {
                position: position,
                size: size,
                origin: subtractLocations(getPlayerBlockLocation(player), position),
                blockCount: regionVolume(start, end)
            }
            return false;
        }

        return true;
    }
    
    load(name: string, location: BlockLocation, player: Player, mode: 'absolute' | 'relative') {
        const structName = RegionsManager.genName(name, player);
        if (this.structures[structName]) {
            let loadPos = location;
            if (mode == 'relative') {
                loadPos = subtractLocations(location, this.structures[structName].origin);
            }
            return Server.runCommand(`structure load ${structName} ${printLocation(loadPos, false)}`, getPlayerDimension(player)[1]).error;
        }
        return true;
    }
    
    has(name: string, player: Player) {
        return RegionsManager.genName(name, player) in this.structures;
    }

    delete(name: string, player: Player) {
        const structName = RegionsManager.genName(name, player);
        if (this.structures[structName]) {
            const error = Server.runCommand(`structure delete ${structName}`).error;
            delete this.structures[structName];
            return error;
        }
        return true;
    }
    
    deletePlayer(player: Player) {
        for (const struct in this.structures) {
            if (struct.endsWith(player.nameTag)) {
                const error = Server.runCommand(`structure delete ${struct}`).error;
                if (error) {
                    return true;
                }
                delete this.structures[struct];
            }
        }
        return false;
    }

    getOrigin(name: string, player: Player) {
        return this.structures[RegionsManager.genName(name, player)].origin;
    }

    getPosition(name: string, player: Player) {
        return this.structures[RegionsManager.genName(name, player)].position;
    }

    getSize(name: string, player: Player) {
        return this.structures[RegionsManager.genName(name, player)].size;
    }

    getBlockCount(name: string, player: Player) {
        return this.structures[RegionsManager.genName(name, player)].blockCount;
    }
}

export const Regions = new RegionsManager()

