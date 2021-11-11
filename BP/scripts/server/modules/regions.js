import { BlockLocation } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation, regionMin, regionMax, regionSize, regionVolume, subtractLocations } from '../util.js';
class RegionsManager {
    constructor() {
        this.MAX_SIZE = [64, 256, 64];
        this.structures = {};
    }
    genName(name, player) {
        return `wedit:${name}_${player.nameTag.replace(' ', '_')}`;
    }
    save(name, start, end, player) {
        const min = regionMin(start, end);
        const max = regionMax(start, end);
        const size = regionSize(start, end);
        const structName = this.genName(name, player);
        const dimension = PlayerUtil.getDimension(player)[1];
        if (size.x > this.MAX_SIZE[0] || size.y > this.MAX_SIZE[1] || size.z > this.MAX_SIZE[2]) {
            const subStructs = [];
            for (let z = 0; z < size.z; z += this.MAX_SIZE[2])
                for (let y = 0; y < size.y; y += this.MAX_SIZE[1])
                    for (let x = 0; x < size.x; x += this.MAX_SIZE[0]) {
                        const subStart = printLocation(min.offset(x, y, z), false);
                        const subEnd = printLocation(regionMin(new BlockLocation(x, y, z).offset(...this.MAX_SIZE), size)
                            .offset(min.x - 1, min.y - 1, min.z - 1), false);
                        const subName = structName + `_${x}_${y}_${z}`;
                        /* printDebug(subName);
                        printDebug(subStart);
                        printDebug(subEnd); */
                        if (!Server.runCommand(`structure save ${subName} ${subStart} ${subEnd} false memory`, dimension).error) {
                            subStructs.push([x, y, z]);
                        }
                        else {
                            for (const sub of subStructs) {
                                Server.runCommand(`structure delete ${structName}_${x}_${y}_${z}`);
                            }
                            return true;
                        }
                    }
            this.structures[structName] = {
                subRegions: subStructs,
                position: min,
                size: size,
                origin: subtractLocations(PlayerUtil.getBlockLocation(player), min),
                blockCount: regionVolume(start, end)
            };
            return false;
        }
        else {
            const startStr = printLocation(min, false);
            const endStr = printLocation(max, false);
            /* printDebug(structName);
            printDebug(startStr);
            printDebug(endStr); */
            if (!Server.runCommand(`structure save ${structName} ${startStr} ${endStr} false memory`, dimension).error) {
                this.structures[structName] = {
                    position: min,
                    size: size,
                    origin: subtractLocations(PlayerUtil.getBlockLocation(player), min),
                    blockCount: regionVolume(start, end)
                };
                return false;
            }
        }
        return true;
    }
    load(name, location, player, mode) {
        const structName = this.genName(name, player);
        const struct = this.structures[structName];
        if (struct) {
            const dimension = PlayerUtil.getDimension(player)[1];
            let loadPos = location;
            if (mode == 'relative') {
                loadPos = subtractLocations(location, struct.origin);
            }
            if (struct.subRegions) {
                let success = false;
                for (const sub of struct.subRegions) {
                    const subLoad = printLocation(loadPos.offset(...sub), false);
                    //printDebug(`${structName}_${sub[0]}_${sub[1]}_${sub[2]}`);
                    //printDebug(subLoad);
                    const s = !Server.runCommand(`structure load ${structName}_${sub[0]}_${sub[1]}_${sub[2]} ${subLoad}`, dimension).error;
                    //printDebug(s);
                    success || (success = s);
                }
                return !success;
            }
            else {
                return Server.runCommand(`structure load ${structName} ${printLocation(loadPos, false)}`, dimension).error;
            }
        }
        return true;
    }
    has(name, player) {
        return this.genName(name, player) in this.structures;
    }
    delete(name, player) {
        const structName = this.genName(name, player);
        const struct = this.structures[structName];
        if (struct) {
            let error = false;
            if (struct.subRegions) {
                for (const sub of struct.subRegions) {
                    error || (error = !Server.runCommand(`structure delete ${structName}_${sub[0]}_${sub[1]}_${sub[2]}`).error);
                }
            }
            else {
                error = Server.runCommand(`structure delete ${structName}`).error;
            }
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
        return this.structures[this.genName(name, player)].origin;
    }
    getPosition(name, player) {
        return this.structures[this.genName(name, player)].position;
    }
    getSize(name, player) {
        return this.structures[this.genName(name, player)].size;
    }
    getBlockCount(name, player) {
        return this.structures[this.genName(name, player)].blockCount;
    }
}
export const Regions = new RegionsManager();
