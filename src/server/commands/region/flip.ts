import { registerCommand } from "../register_commands.js";
import { assertClipboard } from "@modules/assert.js";
import { Cardinal } from "@modules/directions.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { transformSelection } from "./transform_func.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation: CommandInfo = {
    name: "flip",
    permission: "worldedit.region.flip",
    description: "commands.wedit:flip.description",
    usage: [{ flag: "o" }, { flag: "w" }, { flag: "s" }, { name: "direction", type: "Direction", default: new Cardinal(Cardinal.Dir.LEFT) }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const dir: Vector = args.get("direction").getDirection(builder);
    const flip = Vector.ONE;
    if (dir.x) flip.x *= -1;
    if (dir.y) flip.y *= -1;
    if (dir.z) flip.z *= -1;

    let blockCount = 0;
    if (args.has("w")) {
        yield* Jobs.run(session, 4, transformSelection(session, builder, args, { scale: flip }));
        blockCount = session.selection.getBlockCount();
    } else {
        assertClipboard(session);
        const clipTrans = session.clipboardTransform;

        // TODO: Get -o flag working for clipboard flips again
        // if (!args.has("o")) {
        //     if (Math.abs(dir.x)) {
        //         clipTrans.offset.x *= -1;
        //     } else if (Math.abs(dir.z)) {
        //         clipTrans.offset.z *= -1;
        //     }
        // }

        clipTrans.scale = clipTrans.scale.mul(flip);
        blockCount = session.clipboard.getVolume();
    }

    return RawText.translate("commands.wedit:flip.explain").with(blockCount);
});
