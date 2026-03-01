import { Cardinal, CardinalDirection } from "@modules/directions.js";
import { Mask } from "@modules/mask.js";
import { Vector, regionIterateBlocks } from "@notbeer-api";
import { Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { RegionBuffer } from "@modules/region_buffer.js";

class StackerTool extends Tool {
    public range: number;
    public mask: Mask;

    permission = "worldedit.region.stack";

    constructor(range: number, mask: Mask) {
        super();
        this.range = range;
        this.mask = mask;
    }

    *useOn(player: Player, session: PlayerSession, loc: Vector) {
        const dim = player.dimension;
        const dir = new Cardinal(CardinalDirection.Back).getDirection(player);
        const start = loc.add(dir);
        const mask = this.mask.withContext(session);
        if (!mask.matchesBlock(dim.getBlock(start))) {
            return;
        }
        let end = loc;
        for (let i = 0; i < this.range; i++) {
            end = end.add(dir);
            if (!mask.matchesBlock(dim.getBlock(end.add(dir)))) break;
        }
        const history = session.history;
        const record = history.record();
        let tempStack: RegionBuffer;
        try {
            yield* history.trackRegion(record, start, end);
            tempStack = yield* RegionBuffer.createFromWorld(loc, loc, dim);
            for (const pos of regionIterateBlocks(start, end)) yield* tempStack.load(pos, dim);
            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        } finally {
            tempStack?.deref();
        }
    }

    toJSON() {
        return {
            toolType: this.type,
            range: this.range,
            mask: this.mask,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        return [json.range, new Mask(json.mask)];
    }
}

Tools.register(StackerTool, "stacker_wand");
