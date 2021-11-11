import { Server } from '../../library/Minecraft.js';
class PlayerHandler {
    constructor() {
        this.playerDimensions = new Map();
        Server.on('tick', tick => {
            for (const entry of playerDimensions) {
                entry[1][0] = false;
            }
        });
    }
    hasItem(player, item) {
        return !Server.runCommand(`clear "${player.nameTag}" ${item} 0 0`).error;
    }
    replaceItem(player, item, sub) {
        const inv = player.getComponent('inventory').container;
        for (let i = 0; i < inv.size; i++) {
            if (inv.getItem(i)?.id === item) {
                const slotType = i > 8 ? 'slot.inventory' : 'slot.hotbar';
                const slotId = i > 8 ? i - 9 : i;
                // printDebug(slotId);
                // printDebug(slotType);
                // printDebug(item + ' -> ' + sub);
                Server.runCommand(`replaceitem entity "${player.nameTag}" ${slotType} ${slotId} ${sub}`);
                break;
            }
        }
    }
    getBlockLocation(player) {
        return new BlockLocation(Math.floor(player.location.x), Math.floor(player.location.y), Math.floor(player.location.z));
    }
    requestDirection(player) {
        return new Promise((resolve) => {
            const locA = player.location;
            let locB;
            const dimension = getPlayerDimension(player)[1];
            const onSpawn = (entity) => {
                if (entity.id == 'wedit:direction_marker') {
                    locB = entity.location;
                    entity.nameTag = 'wedit:pending_deletion_of_selector';
                    Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimension);
                    entity.kill();
                    let dir = [locB.x - locA.x, locB.y - locA.y, locB.z - locA.z];
                    const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
                    dir = dir.map(v => { return v / len; });
                    Server.off('entityCreate', onSpawn);
                    resolve(new Location(dir[0], dir[1], dir[2]));
                }
            };
            Server.prependOnceListener('entityCreate', onSpawn);
            Server.runCommand(`execute "${player.nameTag}" ~~~ summon wedit:direction_marker ^^^20`, dimension);
        });
    }
    getDimension(player) {
        if (playerDimensions.get(player.nameTag)?.[0]) {
            return playerDimensions.get(player.nameTag).slice(1);
        }
        const blockLoc = getPlayerBlockLocation(player);
        for (const dimName of ['overworld', 'nether', 'the end']) {
            const dimension = World.getDimension(dimName);
            const entities = dimension.getEntitiesAtBlockLocation(blockLoc);
            for (const entity of entities) {
                if (entity.id == 'minecraft:player' && entity.nameTag == player.nameTag) {
                    playerDimensions.set(player.nameTag, [true, dimension, dimName]);
                    return [dimension, dimName];
                }
            }
        }
        return playerDimensions.get(player.nameTag).slice(1) || [null, null];
    }
}
export const PlayerUtils = new PlayerHandler();
