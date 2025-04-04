import { assertCuboidSelection } from "@modules/assert.js";
import { JobFunction, Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { RawText, Vector } from "@notbeer-api";
import { BlockPermutation, Block } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";
import { RegionBuffer } from "@modules/region_buffer.js";

const registerInformation = {
    name: "copy",
    permission: "worldedit.clipboard.copy",
    description: "commands.wedit:copy.description",
    usage: [
        {
            flag: "a",
        },
        {
            flag: "e",
        },
        {
            flag: "m",
            name: "mask",
            type: "Mask",
        },
    ],
};

/**
 * Copies a region into a buffer. When performed in a job, takes 1 step to execute.
 * @param session The session whose player is running this command
 * @param args The arguments that change how the copying will happen
 * @param toClipboard Whether the created buffer is set to the session's clipboard.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* copy(session: PlayerSession, args: Map<string, any>, toClipboard: boolean): Generator<JobFunction | Promise<unknown>, RegionBuffer> {
    assertCuboidSelection(session);
    const player = session.player;
    const [start, end] = session.selection.getRange();

    const usingItem = args.get("_using_item");
    const includeEntities: boolean = usingItem ? session.includeEntities : args.has("e");
    const includeAir: boolean = usingItem ? session.includeAir : !args.has("a");
    const mask = (usingItem ? session.globalMask.clone() : <Mask>args.get("m-mask"))?.withContext(session);

    const airBlock = BlockPermutation.resolve("minecraft:air");
    const filter = mask || !includeAir;

    yield Jobs.nextStep("Copying blocks...");
    const blocks = (block: Block) => {
        const isAir = block.isAir;
        const willBeAir = isAir || (mask ? !mask.matchesBlock(block) : false);
        if (includeAir && mask && !isAir && willBeAir) return airBlock;
        else if (!includeAir && willBeAir) return false;
        return true;
    };

    const buffer = yield* session.createRegion(start, end, { includeEntities, modifier: filter ? blocks : undefined });
    if (!buffer) return undefined;

    if (toClipboard) {
        if (session.clipboard) session.deleteRegion(session.clipboard);
        session.clipboardTransform = {
            rotation: Vector.ZERO,
            scale: Vector.ONE,
            originalLoc: start,
            originalDim: player.dimension.id,
            offset: Vector.sub(start, Vector.from(player.location).floor().add(0.5)),
        };
        session.clipboard = buffer;
    }

    return buffer;
}

registerCommand(registerInformation, function* (session, builder, args) {
    assertCuboidSelection(session);
    if (!(yield* Jobs.run(session, 1, copy(session, args, true)))) {
        throw RawText.translate("commands.generic.wedit:commandFail");
    }
    return RawText.translate("commands.wedit:copy.explain").with(`${session.clipboard.getVolume()}`);
});
