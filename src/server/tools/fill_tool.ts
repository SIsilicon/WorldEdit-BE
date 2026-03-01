import { Vector3, Player } from "@minecraft/server";
import { PlayerSession } from "../sessions.js";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Pattern } from "@modules/pattern.js";
import { Jobs } from "@modules/jobs.js";
import { regionBounds } from "@notbeer-api";
import { floodFill } from "server/commands/utilities/floodfill_func.js";
import { Cardinal, CardinalDirection } from "@modules/directions.js";

class FillTool extends Tool {
    public pattern: Pattern;
    public radius: number;
    public depth: number;
    public direction: Cardinal;

    onSurface = true;

    permission = "worldedit.utility.fillr";

    *useOn(player: Player, session: PlayerSession, loc: Vector3) {
        const fillDir = this.direction.getDirection(player);
        const radius = this.radius;
        const depth = this.depth;
        let pattern = this.pattern;

        yield* Jobs.run(session, 1, function* () {
            yield Jobs.nextStep("commands.wedit:blocks.calculating_generating");
            yield Jobs.setProgress(-1);

            const blocks = yield* floodFill(loc, radius, (ctx, dir) => {
                const dotDir = fillDir.dot(dir);
                if (dotDir < 0) return false;
                if (fillDir.dot(ctx.pos.add(dir)) > depth - 1) return false;
                if (!ctx.nextBlock.isAir) return false;
                return true;
            });

            if (!blocks.size) return blocks;
            const [min, max] = regionBounds(blocks);
            pattern = pattern.withContext(session, [min, max]);

            const history = session.history;
            const record = history.record();
            try {
                yield* history.trackRegion(record, blocks);
                let i = 0;
                for (const loc of blocks) {
                    pattern.setBlock(yield* Jobs.loadBlock(loc));
                    yield Jobs.setProgress(i++ / blocks.size);
                }
                yield* history.commit(record);
            } catch (err) {
                history.cancel(record);
                throw err;
            }
            return blocks;
        });
    }

    constructor(pattern: Pattern, radius: number, depth: number, direction = new Cardinal(CardinalDirection.Down)) {
        super();
        this.pattern = pattern;
        this.radius = radius;
        this.depth = depth;
        this.direction = direction;
    }

    toJSON() {
        return {
            toolType: this.type,
            pattern: this.pattern,
            radius: this.radius,
            depth: this.depth,
            direction: this.direction,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static parseJSON(json: { [key: string]: any }) {
        return [new Pattern(json.pattern), json.radius, json.depth, new Cardinal(json.direction)];
    }
}
Tools.register(FillTool, "fill_wand");
