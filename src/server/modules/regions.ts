import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation, placeBlock, regionSize, regionVolume, regionCenter, regionBounds } from '../util.js';
import { Vector } from './vector.js';
import { parsedBlock } from './parser.js';

interface StructureMeta {
    blocks: Map<Vector, parsedBlock>;
    blockCount: number;
    
    subRegions?: [string, Vector, Vector][]; // name suffix, offset, end
    position: Vector;
    size: Vector;
    origin: Vector; // position relative to player upon saving
    rotation?: number; // increments of 90 only
    flip?: 0|1|2|3; // first bit: x, second bit: z
}

class RegionsManager {
    private readonly MAX_SIZE: Vector = new Vector(64, 256, 64);
    
    private readonly structures = new Map<string, StructureMeta>();
    private readonly ids = new Map<string, string>();

    private genName(name: string, player: Player) {
        if (!this.ids.has(player.nameTag)) {
            do {
                var id = '';
                let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let charsLength = chars.length;
                for (let i = 0; i < 4; i++) {
                    id += chars.charAt(Math.floor(Math.random() * charsLength));
                }
            } while (Array.from(this.ids.values()).includes(id));
            this.ids.set(player.nameTag, id);
            printDebug(`Given "${player.nameTag}" a region ID of ${id}.`);
        }
        return `wedit:${name}_${this.ids.get(player.nameTag)}`;
    }
    
    save(name: string, start: BlockLocation, end: BlockLocation, player: Player, includeEntities = false, individualBlocks = false) {
        const min = Vector.min(start, end);
        const max = Vector.max(start, end);
        const size = Vector.from(regionSize(start, end));
        const structName = this.genName(name, player);
        
        const dim = player.dimension;
        let blocks: Map<Vector, parsedBlock> = null;
        if (individualBlocks) {
            const orgBlock = min.toBlock();
            blocks = new Map<Vector, parsedBlock>();
            for (let x = 0; x < size.x; x++)
            for (let y = 0; y < size.x; y++)
            for (let z = 0; z < size.x; z++) {
                const block = dim.getBlock(orgBlock.offset(x, y, z)).permutation;
                const states: parsedBlock['states'] = new Map();
                for (const state of block.getAllProperties()) {
                    states.set(state.name, state.value);
                }
                blocks.set(new Vector(x, y, z), {
                    id: block.type.id,
                    data: -1,
                    states: states
                });
            }
            var blockCount = blocks.size;
        } else {
            var blockCount = regionVolume(start, end);
        }
        
        if (size.x > this.MAX_SIZE.x || size.y > this.MAX_SIZE.y || size.z > this.MAX_SIZE.z) {
            const subStructs: [string, Vector, Vector][] = [];
            for (let z = 0; z < size.z; z += this.MAX_SIZE.z)
            for (let y = 0; y < size.y; y += this.MAX_SIZE.y)
            for (let x = 0; x < size.x; x += this.MAX_SIZE.x) {
                const subStart = min.add([x, y, z]);
                const subEnd = Vector.min(
                    new Vector(x, y, z).add(this.MAX_SIZE), size
                ).add(min).sub(Vector.ONE);
                const subName = `_${x/this.MAX_SIZE.x}_${y/this.MAX_SIZE.y}_${z/this.MAX_SIZE.z}`;
                
                if (!Server.runCommand(`structure save ${structName + subName} ${subStart.print()} ${subEnd.print()} ${includeEntities} memory`, dim).error) {
                    subStructs.push([
                        subName,
                        new Vector(x, y, z),
                        subEnd.sub(min).add(Vector.ONE)
                    ]);
                } else {
                    for (const sub of subStructs) {
                        Server.runCommand(`structure delete ${structName + subName}`);
                    }
                    return true;
                }
            }
            
            this.structures.set(structName, {
                subRegions: subStructs,
                position: min,
                size: size,
                origin: Vector.sub(player.location, min).floor(),
                blocks: blocks,
                blockCount: blockCount
            });
            return false;
        } else {
            const startStr = min.print();
            const endStr = max.print();
            
            if (!Server.runCommand(`structure save ${structName} ${startStr} ${endStr} ${includeEntities} memory`, dim).error) {
                this.structures.set(structName, {
                    position: min,
                    size: size,
                    origin: Vector.sub(player.location, min).floor(),
                    blocks: blocks,
                    blockCount: blockCount
                });
                return false;
            }
        }
        return true;
    }
    
    load(name: string, location: BlockLocation, player: Player) {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            const dimension = player.dimension;
            let loadPos = Vector.from(location);
            const rotation = `${struct.rotation ?? 0}_degrees`;
            const flip = {0: 'none', 1: 'z', 2: 'x', 3: 'xz'}[struct.flip ?? 0];
            
            if (struct.subRegions) {
                let success = false;
                for (const sub of struct.subRegions) {
                    const subLoad = loadPos.add(sub[1]);
                    
                    const s = !Server.runCommand(`structure load ${structName + sub[0]} ${subLoad.print()} ${rotation} ${flip}`, dimension).error;
                    success ||= s;
                }
                return !success;
            } else {
                return Server.runCommand(`structure load ${structName} ${loadPos.print()} ${rotation} ${flip}`, dimension).error;
            }
        }
        return true;
    }
    
    // TODO: stack rotate and flip actions on top of each other
    rotate(name: string, rotation: number, origin: Vector, player: Player) {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            const d = 360;
            const rot = (struct.rotation ?? 0) + rotation;
            struct.rotation = rot >= 0 ? rot % d : (rot % d + d) % d;
            
            let oldOrigin = struct.origin.add(struct.position);
            let oldEnd = struct.position.add(struct.size.sub(Vector.ONE));
            let [start, end] = regionBounds([
                struct.position.rotate(rotation, origin).toBlock(),
                oldEnd.rotate(rotation, origin).toBlock()
            ]);
            
            if (struct.subRegions) {
                let min: Vector;
                const newBounds: [BlockLocation, BlockLocation][] = [];
                for (const sub of struct.subRegions) {
                    let [start, end] = regionBounds([
                        sub[1].rotate(rotation).toBlock(),
                        sub[2].rotate(rotation).toBlock()
                    ]);
                    // printDebug(sub[1], sub[2], '-', start, end);
                    min = !min ? Vector.from(start) : min.min(start);
                    // printDebug('min', min)
                    newBounds.push([start, end]);
                }
                for (let i = 0; i < newBounds.length; i++) {
                    struct.subRegions[i][1] = Vector.sub(newBounds[i][0], min);
                    struct.subRegions[i][2] = Vector.sub(newBounds[i][1], min);
                }
            }
            
            struct.position = Vector.from(start);
            struct.size = Vector.from(end).sub(start).add(Vector.ONE);
            struct.origin = oldOrigin.sub(struct.position);
            
            return false;
        }
        return true;
    }
    
    flip(name: string, direction: Vector, origin: Vector, player: Player) {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            let flip = struct.flip ?? 0;
            let dir_sc: Vector;
            if (direction.x != 0) {
                flip ^= 0b01;
                dir_sc = new Vector(-1, 1, 1);
            } else if (direction.z != 0) {
                flip ^= 0b10;
                dir_sc = new Vector(1, 1, -1);
            } else {
                return true;
            }
            struct.flip = flip as 0|1|2|3;
            
            let oldOrigin = struct.origin.add(struct.position);
            let oldEnd = struct.position.add(struct.size.sub(Vector.ONE));
            let [start, end] = regionBounds([
                struct.position.sub(origin).mul(dir_sc).add(origin).toBlock(),
                oldEnd.sub(origin).mul(dir_sc).add(origin).toBlock()
            ]);
            
            if (struct.subRegions) {
                let min: Vector;
                const newBounds: [BlockLocation, BlockLocation][] = [];
                for (const sub of struct.subRegions) {
                    let [start, end] = regionBounds([
                        sub[1].mul(dir_sc).toBlock(),
                        sub[2].mul(dir_sc).toBlock()
                    ]);
                    min = !min ? Vector.from(start) : min.min(start);
                    newBounds.push([start, end]);
                }
                for (let i = 0; i < newBounds.length; i++) {
                    struct.subRegions[i][1] = Vector.sub(newBounds[i][0], min);
                    struct.subRegions[i][2] = Vector.sub(newBounds[i][1], min);
                }
            }
            
            struct.position = Vector.from(start);
            struct.size = Vector.from(end).sub(start).add(Vector.ONE);
            struct.origin = oldOrigin.sub(struct.position);
            
            return false;
        }
        return true;
    }
    
    has(name: string, player: Player) {
        return this.structures.has(this.genName(name, player));
    }

    delete(name: string, player: Player) {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            let error = false;
            if (struct.subRegions) {
                for (const sub of struct.subRegions) {
                    error ||= !Server.runCommand(`structure delete ${structName}_${sub[0]}_${sub[1]}_${sub[2]}`).error;
                }
            } else {
                error = Server.runCommand(`structure delete ${structName}`).error;
            }
            this.structures.delete(structName);
            return error;
        }
        return true;
    }
    
    deletePlayer(player: Player) {
        this.structures.forEach((_, struct) => {
            if (struct.endsWith('_' + this.ids.get(player.nameTag))) {
                const error = this.delete(struct, player);
                if (error) {
                    return true;
                }
            }
        });
        this.ids.delete(player.nameTag);
        return false;
    }

    getOrigin(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).origin.toBlock();
    }

    getPosition(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).position.toBlock();
    }

    getSize(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).size.toBlock();
    }
    
    getBounds(name: string, player: Player): [BlockLocation, BlockLocation] {
        const struct = this.structures.get(this.genName(name, player));
        return [
            struct.position.toBlock(),
            struct.position.add(struct.size).sub(Vector.ONE).toBlock()
        ];
    }
    
    getBlockCount(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).blockCount;
    }
}

export const Regions = new RegionsManager();
