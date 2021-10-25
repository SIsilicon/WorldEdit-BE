import { Server } from '../../library/Minecraft.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation, regionMin, regionSize, regionVolume, subtractLocations } from '../util.js';
import { RawText } from './rawtext.js';
class RegionsManager {
    constructor() {
        this.structures = {};
    }
    static genName(name, player) {
        return `wedit:${name}_${player.nameTag}`;
    }
    save(name, start, end, player) {
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
            };
            return false;
        }
        return true;
    }
    load(name, location, player, mode) {
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
    has(name, player) {
        return RegionsManager.genName(name, player) in this.structures;
    }
    delete(name, player) {
        const structName = RegionsManager.genName(name, player);
        if (this.structures[structName]) {
            const error = Server.runCommand(`structure delete ${structName}`).error;
            delete this.structures[structName];
            return error;
        }
        return true;
    }
    deletePlayer(player) {
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
    getOrigin(name, player) {
        return this.structures[RegionsManager.genName(name, player)].origin;
    }
    getPosition(name, player) {
        return this.structures[RegionsManager.genName(name, player)].position;
    }
    getSize(name, player) {
        return this.structures[RegionsManager.genName(name, player)].size;
    }
    getBlockCount(name, player) {
        return this.structures[RegionsManager.genName(name, player)].blockCount;
    }
}
export const Regions = new RegionsManager();
