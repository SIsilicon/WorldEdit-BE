import { Cardinal } from "@modules/directions.js";
import { Vector, regionBounds, regionOffset } from "@notbeer-api";
import { Block, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { RegionBuffer } from "@modules/region_buffer.js";
import { floodFill } from "server/commands/utilities/floodfill_func.js";
import { Jobs } from "@modules/jobs.js";

class ExtrudeTool extends Tool {
    public range: number;
    public digging = false;

    permission = "worldedit.region.extruder";
    useOn = function* (self: ExtrudeTool, player: Player, session: PlayerSession, loc: Vector) {
        const dim = player.dimension;
        const extrudeDir = new Cardinal(Cardinal.Dir.BACK).getDirection(player);
        const extrudeOffset = Vector.from(extrudeDir);
        const startBlockType = dim.getBlock(loc).type;

        yield* Jobs.run(session, 1, function* () {
            const blocks = yield* floodFill(loc, self.range, (ctx, dir) => extrudeDir.dot(dir) === 0 && ctx.nextBlock.type === startBlockType && isAirOrFluid(ctx.nextBlock.offset(extrudeOffset)));
            if (!blocks.size) return;

            let [start, end] = regionBounds(blocks);

            const history = session.history;
            const record = history.record();
            let tempExtrude: RegionBuffer;
            try {
                if (self.digging) {
                    let i = 0;
                    const blockCount = blocks.size;
                    for (const block of blocks) {
                        yield blocks.add(block.add(extrudeOffset));
                        if (++i >= blockCount) break;
                    }
                    // Include blocks infront of the extrusion
                    [start, end] = regionBounds(blocks);
                    tempExtrude = yield* RegionBuffer.createFromWorld(start, end, dim, {
                        recordBlocksWithData: true,
                        modifier: (block) => blocks.has(block) && !block.offset(extrudeDir.mul(-1))!.matches("air"),
                    });
                    [start, end] = regionOffset(start, end, extrudeDir.mul(-1));
                } else {
                    tempExtrude = yield* RegionBuffer.createFromWorld(start, end, dim, { recordBlocksWithData: true, modifier: (block) => blocks.has(block) });
                    [start, end] = regionOffset(start, end, extrudeDir);
                }

                yield* history.trackRegion(record, start, end);
                yield* tempExtrude.load(start, dim);
                yield* history.commit(record);
            } catch (e) {
                history.cancel(record);
                throw e;
            } finally {
                tempExtrude?.deref();
            }
        });
    };

    constructor(range: number, digging: boolean) {
        super();
        this.range = range;
        this.digging = digging;
    }

    toJSON() {
        return {
            toolType: this.type,
            range: this.range,
            digging: this.digging,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        return [json.range, json.digging];
    }
}

Tools.register(ExtrudeTool, "extruder_wand");

function isAirOrFluid(block: Block) {
    const type = block.typeId;
    return type === "minecraft:air" || type === "minecraft:water" || type === "minecraft:lava";
}
