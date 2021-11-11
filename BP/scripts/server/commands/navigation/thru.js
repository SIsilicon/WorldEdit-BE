import { Server } from '../../../library/Minecraft.js';
import { assertNoArgs } from '../../modules/assert.js';
import { RawText } from '../../modules/rawtext.js';
import { getPlayerBlockLocation, getPlayerDimension, printLocation, requestPlayerDirection } from '../../util.js';
import { commandList } from '../command_list.js';
const registerInformation = {
    cancelMessage: true,
    name: 'thru',
    description: 'Teleport you through any wall you look at.',
    usage: ''
};
commandList['thru'] = [registerInformation, (session, builder, args) => {
        assertNoArgs(args);
        const [dimension, dimName] = PlayerUtil.getDimension(builder);
        const blockLoc = PlayerUtil.getBlockLocation(builder);
        return PlayerUtil.requestDirection(builder).then(dir => {
            let cardinal;
            const absDir = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
            if (absDir[0] > absDir[1] && absDir[0] > absDir[2]) {
                cardinal = [Math.sign(dir.x), 0, 0];
            }
            else if (absDir[2] > absDir[0] && absDir[2] > absDir[1]) {
                cardinal = [0, 0, Math.sign(dir.z)];
            }
            else {
                cardinal = [0, Math.sign(dir.y), 0];
            }
            function isSpaceEmpty(loc) {
                return dimension.getBlock(loc).isEmpty && dimension.getBlock(loc.offset(0, 1, 0)).isEmpty;
            }
            let testLoc = blockLoc.offset(...cardinal);
            if (isSpaceEmpty(testLoc)) {
                throw RawText.translate('worldedit.thru.none');
            }
            let canGoThrough = false;
            for (let i = 0; i < (cardinal[1] == 0 ? 3 : 4); i++) {
                testLoc = testLoc.offset(...cardinal);
                if (isSpaceEmpty(testLoc)) {
                    canGoThrough = true;
                    break;
                }
            }
            if (canGoThrough) {
                Server.runCommand(`tp "${builder.nameTag}" ${printLocation(testLoc, false)}`, dimName);
                return RawText.translate('worldedit.thru.moved');
            }
            else {
                throw RawText.translate('worldedit.thru.obstructed');
            }
        });
    }];
