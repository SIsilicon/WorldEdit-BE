import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { floodFill } from "./floodfill_func.js";
import { canPlaceBlock } from "server/util.js";

const registerInformation: CommandInfo = {
    name: "drain",
    permission: "worldedit.utility.drain",
    description: "commands.wedit:drain.description",
    usage: [{ name: "radius", type: "float" }],
};

export const fluidLookPositions = [
    new Vector(0, 0, 0),
    new Vector(-1, 0, 0),
    new Vector(1, 0, 0),
    new Vector(0, 0, -1),
    new Vector(0, 0, 1),
    new Vector(0, -1, 0),
    new Vector(-1, -1, 0),
    new Vector(1, -1, 0),
    new Vector(0, -1, -1),
    new Vector(0, -1, 1),
];

registerCommand(registerInformation, function* (session, builder, args) {
    const dimension = builder.dimension;
    const playerBlock = session.getPlacementPosition();
    let fluidMatch: string;
    let drainStart: Vector;
    for (const offset of fluidLookPositions) {
        const loc = playerBlock.offset(offset.x, offset.y, offset.z);
        if (!canPlaceBlock(loc, dimension)) continue;
        const block = dimension.getBlock(loc);
        if (block.typeId.match("water") || block.isWaterlogged) fluidMatch = "water";
        else if (block.typeId.match("lava")) fluidMatch = "lava";
        else continue;

        drainStart = loc;
        break;
    }
    const drainWaterLogged = fluidMatch === "water";

    if (!drainStart) throw "commands.wedit:drain.noFluid";

    const blocks = yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("Calculating and Draining blocks...");
        yield Jobs.setProgress(-1);

        const blocks = yield* floodFill(drainStart, args.get("radius"), (ctx) => {
            if (!ctx.nextBlock.typeId.match(fluidMatch)) return drainWaterLogged && ctx.nextBlock.isWaterlogged;
            return true;
        });

        if (!blocks.size) return blocks;
        const history = session.history;
        const record = history.record();
        try {
            yield* history.trackRegion(record, blocks);
            let i = 0;
            for (const loc of blocks) {
                const block = dimension.getBlock(loc) ?? (yield* Jobs.loadBlock(loc));
                if (drainWaterLogged && !block.typeId.match(fluidMatch)) block.setWaterlogged(false);
                else block.setType("air");
                yield Jobs.setProgress(i++ / blocks.size);
            }
            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }
        return blocks;
    });

    return RawText.translate("commands.blocks.wedit:changed").with(`${blocks.size}`);
});
