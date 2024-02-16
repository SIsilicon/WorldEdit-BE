import { Jobs } from "@modules/jobs.js";
import { RawText, regionBounds, Vector } from "@notbeer-api";
import { BlockPermutation } from "@minecraft/server";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";
import { floodFill } from "./floodfill_func.js";
import { canPlaceBlock } from "server/util.js";

const registerInformation = {
    name: "drain",
    permission: "worldedit.utility.drain",
    description: "commands.wedit:drain.description",
    usage: [
        {
            flag: "w"
        },
        {
            name: "radius",
            type: "float"
        }
    ]
};

export const waterMatch = /minecraft:.*water/;
export const lavaMatch = /minecraft:.*lava/;

export const fluidLookPositions = [
    new Vector( 0, 0, 0),
    new Vector(-1, 0, 0),
    new Vector( 1, 0, 0),
    new Vector( 0, 0,-1),
    new Vector( 0, 0, 1),
    new Vector( 0,-1, 0),
    new Vector(-1,-1, 0),
    new Vector( 1,-1, 0),
    new Vector( 0,-1,-1),
    new Vector( 0,-1, 1)
];

registerCommand(registerInformation, function* (session, builder, args) {
    // TODO: Assert Can Build within

    const dimension = builder.dimension;
    const playerBlock = session.getPlacementPosition();
    let fluidMatch: typeof waterMatch | typeof lavaMatch;
    let drainStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        if (!canPlaceBlock(loc, dimension)) continue;
        const block = dimension.getBlock(loc);
        if (block.typeId.match(waterMatch) || (args.has("w") && block.isWaterlogged)) {
            fluidMatch = waterMatch;
        } else if (block.typeId.match(lavaMatch)) {
            fluidMatch = lavaMatch;
        } else {
            continue;
        }

        drainStart = loc;
        break;
    }
    const drainWaterLogged = fluidMatch == waterMatch && args.has("w");

    if (!drainStart) {
        throw "commands.wedit:drain.noFluid";
    }

    const job = Jobs.startJob(session, 1, new SphereShape(args.get("radius")).getRegion(drainStart));
    Jobs.nextStep(job, "Calculating and Draining blocks...");
    const blocks = yield* floodFill(drainStart, args.get("radius"), (ctx, dir) => {
        const block = dimension.getBlock(ctx.worldPos.offset(dir.x, dir.y, dir.z));

        if (!block.typeId.match(fluidMatch)) return drainWaterLogged && block.isWaterlogged;
        return true;
    });

    if (blocks.length) {
        const [min, max] = regionBounds(blocks);

        const history = session.getHistory();
        const record = history.record();
        const air = BlockPermutation.resolve("minecraft:air");
        try {
            history.addUndoStructure(record, min, max, blocks);
            let i = 0;
            for (const loc of blocks) {
                const block = dimension.getBlock(loc);
                if (drainWaterLogged && !block.typeId.match(fluidMatch)) {
                    block.setWaterlogged(false);
                } else {
                    block.setPermutation(air);
                }
                Jobs.setProgress(job, i++ / blocks.length);
                yield;
            }
            history.addRedoStructure(record, min, max, blocks);
            history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        } finally {
            Jobs.finishJob(job);
        }
    } else {
        Jobs.finishJob(job);
    }

    return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.length}`);
});
